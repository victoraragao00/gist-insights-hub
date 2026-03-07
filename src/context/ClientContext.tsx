import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// ── Types ──

interface Client {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SyncJobRecord {
  id: string;
  type: string;
  status: string;
  client_id: string | null;
  payload: Record<string, unknown> | null;
  progress: Record<string, unknown> | null;
  retry_count: number | null;
  max_retries: number | null;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  heartbeat_at: string | null;
  created_at: string | null;
}

export interface SyncState {
  syncing: boolean;
  jobs: SyncJobRecord[];
  progressPct: number;
  currentLabel: string | null;
  elapsedDisplay: string | null;
}

export interface SyncParams {
  syncContacts: boolean;
  syncHistory: boolean;
}

const INITIAL_SYNC_STATE: SyncState = {
  syncing: false,
  jobs: [],
  progressPct: 0,
  currentLabel: null,
  elapsedDisplay: null,
};

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec}s`;
}

function computeJobProgress(job: SyncJobRecord): number {
  if (TERMINAL_STATUSES.has(job.status)) return 100;
  const progress = job.progress as Record<string, unknown> | null;
  if (!progress) return 0;
  const page = (progress.next_page as number) || 0;
  const total = (progress.total_pages as number) || 0;
  if (total > 0 && page > 0) return Math.min(Math.round((page / total) * 100), 95);
  return job.status === 'running' ? 10 : 0;
}

function computeSyncState(jobs: SyncJobRecord[], startedAt: number | null): SyncState {
  if (jobs.length === 0) return INITIAL_SYNC_STATE;

  const allTerminal = jobs.every(j => TERMINAL_STATUSES.has(j.status));
  const syncing = !allTerminal;

  const totalPct = jobs.reduce((sum, j) => sum + computeJobProgress(j), 0);
  const progressPct = Math.round(totalPct / jobs.length);

  const activeJob = jobs.find(j => j.status === 'running') || jobs.find(j => j.status === 'pending');
  let currentLabel: string | null = null;
  if (activeJob) {
    currentLabel = activeJob.type === 'sync_contacts' ? 'Contatos (global)' : 'Histórico (global)';
  }

  let elapsedDisplay: string | null = null;
  if (syncing && startedAt) {
    elapsedDisplay = `Em andamento há ${formatElapsed(Date.now() - startedAt)}`;
  }

  return { syncing, jobs, progressPct, currentLabel, elapsedDisplay };
}

// ── Context ──

interface ClientContextValue {
  clients: Client[];
  selectedClient: Client | null;
  setSelectedClient: (client: Client) => void;
  loading: boolean;
  syncState: SyncState;
  startSync: (params: SyncParams) => Promise<void>;
  cancelSync: () => void;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<SyncJobRecord[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, metadata, created_at")
        .order("name")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  // Auto-select first client
  if (clients.length > 0 && !selectedClient) {
    setSelectedClient(clients[0]);
  }

  // ── Detect existing active jobs on mount ──
  useEffect(() => {
    if (!user?.id) return;
    const fetchActiveJobs = async () => {
      const { data } = await supabase
        .from('sync_jobs')
        .select('*')
        .in('status', ['pending', 'running'] as any)
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        const ids = data.map((j: any) => j.id);
        setActiveJobIds(prev => {
          const merged = new Set([...prev, ...ids]);
          return Array.from(merged);
        });
        setJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const newJobs = (data as SyncJobRecord[]).filter(j => !existingIds.has(j.id));
          return newJobs.length > 0 ? [...prev, ...newJobs] : prev;
        });
        if (!startedAt) {
          const earliest = data.find((j: any) => j.started_at);
          setStartedAt(earliest?.started_at ? new Date(earliest.started_at).getTime() : Date.now());
        }
      }
    };
    fetchActiveJobs();
  }, [user?.id]);

  // ── Realtime subscription for active jobs ──
  useEffect(() => {
    if (activeJobIds.length === 0) return;

    // Subscribe to changes on sync_jobs
    const channel = supabase
      .channel('sync-jobs-watch')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sync_jobs',
        },
        (payload) => {
          const updated = payload.new as SyncJobRecord;
          if (!activeJobIds.includes(updated.id)) return;

          setJobs(prev => {
            const idx = prev.findIndex(j => j.id === updated.id);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sync_jobs',
        },
        (payload) => {
          const inserted = payload.new as SyncJobRecord;
          // Only auto-track if we already have active jobs (user initiated a sync)
          // This prevents random cron jobs from hijacking the UI
          if (activeJobIds.length === 0) return;
          if (activeJobIds.includes(inserted.id)) return;
          setActiveJobIds(prev => {
            if (prev.includes(inserted.id)) return prev;
            return [...prev, inserted.id];
          });
          setJobs(prev => {
            if (prev.some(j => j.id === inserted.id)) return prev;
            return [...prev, inserted];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeJobIds]);

  // ── Fallback polling (30s) ──
  useEffect(() => {
    if (activeJobIds.length === 0) {
      if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null; }
      return;
    }

    const poll = async () => {
      const { data } = await supabase
        .from('sync_jobs')
        .select('*')
        .in('id', activeJobIds);
      if (data) setJobs(data as SyncJobRecord[]);
    };

    fallbackRef.current = setInterval(poll, 30000);
    return () => { if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null; } };
  }, [activeJobIds]);

  // ── Clear fallback when all jobs terminal ──
  useEffect(() => {
    if (jobs.length === 0 || activeJobIds.length === 0) return;

    const allTerminal = jobs.every(j => TERMINAL_STATUSES.has(j.status));
    if (allTerminal) {
      if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null; }

      // Toast summary
      const hasError = jobs.some(j => j.status === 'failed');
      const hasCancelled = jobs.some(j => j.status === 'cancelled');
      const totalContacts = jobs
        .filter(j => j.type === 'sync_contacts')
        .reduce((s, j) => s + ((j.progress as any)?.contacts_processed || 0), 0);
      const totalMessages = jobs
        .filter(j => j.type === 'ingest_historical')
        .reduce((s, j) => s + ((j.progress as any)?.messages_inserted || 0), 0);

      if (hasCancelled) {
        toast.info("Sincronização cancelada pelo usuário.");
      } else if (hasError) {
        toast.warning(`Sincronização concluída com erro(s) — ${totalContacts} contatos, ${totalMessages} mensagens`);
      } else {
        toast.success(`Sincronização completa — ${totalContacts} contatos, ${totalMessages} mensagens novas`);
      }

      queryClient.invalidateQueries({ queryKey: ["sync_clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["sync_jobs_history"] });

      // Reset after brief delay so UI shows 100%
      setTimeout(() => {
        setActiveJobIds([]);
        setJobs([]);
        setStartedAt(null);
      }, 2000);
    }
  }, [jobs, activeJobIds, queryClient]);

  // ── Elapsed timer ──
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const syncState = computeSyncState(jobs, startedAt);

  // ── Start sync ──
  const startSync = useCallback(async (params: SyncParams) => {
    const { syncContacts, syncHistory } = params;
    if (!syncContacts && !syncHistory) return;

    const newJobIds: string[] = [];
    const newJobs: SyncJobRecord[] = [];

    if (syncContacts) {
      const { data, error } = await supabase.functions.invoke("sync-gist-contacts", { body: {} });
      if (error) { toast.error("Erro ao criar job de contatos: " + (typeof error === 'string' ? error : 'erro')); return; }
      if (data?.job_id) {
        newJobIds.push(data.job_id);
        newJobs.push({ id: data.job_id, type: 'sync_contacts', status: 'pending', client_id: null, payload: {}, progress: {}, retry_count: 0, max_retries: 3, created_by: user?.id ?? null, started_at: null, completed_at: null, heartbeat_at: null, created_at: new Date().toISOString() });
      }
    }

    if (syncHistory) {
      const { data, error } = await supabase.functions.invoke("ingest-gist-historical", { body: {} });
      if (error) { toast.error("Erro ao criar job de histórico: " + (typeof error === 'string' ? error : 'erro')); return; }
      if (data?.job_id) {
        newJobIds.push(data.job_id);
        newJobs.push({ id: data.job_id, type: 'ingest_historical', status: 'pending', client_id: null, payload: {}, progress: {}, retry_count: 0, max_retries: 3, created_by: user?.id ?? null, started_at: null, completed_at: null, heartbeat_at: null, created_at: new Date().toISOString() });
      }
    }

    if (newJobIds.length > 0) {
      setActiveJobIds(newJobIds);
      setJobs(newJobs);
      setStartedAt(Date.now());
    }
  }, [user?.id]);

  // ── Cancel sync ──
  const cancelSync = useCallback(async () => {
    for (const jobId of activeJobIds) {
      await supabase
        .from('sync_jobs')
        .update({ status: 'cancelled' as any, completed_at: new Date().toISOString() })
        .eq('id', jobId)
        .in('status', ['pending', 'running'] as any);
    }
  }, [activeJobIds]);

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClient,
        setSelectedClient,
        loading: isLoading,
        syncState,
        startSync,
        cancelSync,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used inside <ClientProvider>");
  return ctx;
}
