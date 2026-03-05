import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ImportProgress {
  currentPage: number;
  conversationsTotal: number;
  messagesTotal: number;
  done: boolean;
  error?: string;
}

interface IngestionResult {
  conversations_fetched: number;
  messages_fetched: number;
  messages_inserted: number;
  messages_skipped: number;
  errors: string[];
  has_more: boolean;
  next_page?: number;
}

// ── Sync types ──

export interface ClientSyncResult {
  clientId: string;
  clientName: string;
  contacts: number;
  messages: number;
  error?: string;
}

export interface SyncState {
  syncing: boolean;
  cancelled: boolean;
  currentClientName: string | null;
  currentClientIndex: number;
  totalClients: number;
  completedResults: ClientSyncResult[];
  startedAt: number | null;
  progressPct: number;
  elapsedDisplay: string | null;
}

export interface SyncParams {
  syncContacts: boolean;
  syncHistory: boolean;
  selectedClients: { id: string; name: string }[];
}

const INITIAL_SYNC_STATE: SyncState = {
  syncing: false,
  cancelled: false,
  currentClientName: null,
  currentClientIndex: 0,
  totalClients: 0,
  completedResults: [],
  startedAt: null,
  progressPct: 0,
  elapsedDisplay: null,
};

interface ClientContextValue {
  clients: Client[];
  selectedClient: Client | null;
  setSelectedClient: (client: Client) => void;
  loading: boolean;
  importing: boolean;
  importProgress: ImportProgress | null;
  handleImportHistory: () => Promise<void>;
  // Sync
  syncState: SyncState;
  runSync: (params: SyncParams) => Promise<void>;
  cancelSync: () => void;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min ${sec}s`;
}

export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  // ── Sync state ──
  const [syncState, setSyncState] = useState<SyncState>(INITIAL_SYNC_STATE);
  const cancelledRef = useRef(false);

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

  // Auto-select first client when list loads
  if (clients.length > 0 && !selectedClient) {
    setSelectedClient(clients[0]);
  }

  // ── Import history (existing) ──

  const handleImportHistory = useCallback(async () => {
    setImporting(true);
    setImportProgress({ currentPage: 1, conversationsTotal: 0, messagesTotal: 0, done: false });

    let page = 1;
    let totalConversations = 0;
    let totalMessages = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        setImportProgress({
          currentPage: page,
          conversationsTotal: totalConversations,
          messagesTotal: totalMessages,
          done: false,
        });

        const { data, error } = await supabase.functions.invoke("ingest-gist-historical", {
          body: { page },
        });

        if (error) throw new Error(typeof error === "string" ? error : "Erro na importação");

        const result = data as IngestionResult | null;
        if (!result) throw new Error("Resposta vazia");

        totalConversations += result.conversations_fetched;
        totalMessages += result.messages_fetched;
        hasMore = result.has_more;
        page = result.next_page ?? page + 1;
      }

      setImportProgress({
        currentPage: page,
        conversationsTotal: totalConversations,
        messagesTotal: totalMessages,
        done: true,
      });

      queryClient.invalidateQueries({ queryKey: ["interactions_count"] });
      toast.success(`✓ Importação concluída: ${totalConversations} conversas, ${totalMessages} mensagens`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setImportProgress((prev) => prev ? { ...prev, done: true, error: msg } : null);
      toast.error("Erro na importação: " + msg);
    } finally {
      setImporting(false);
    }
  }, [queryClient]);

  // ── Sync logic (moved from SettingsPage) ──

  const cancelSync = useCallback(() => {
    cancelledRef.current = true;
    setSyncState((prev) => ({ ...prev, cancelled: true }));
  }, []);

  const runSync = useCallback(async (params: SyncParams) => {
    const { syncContacts, syncHistory, selectedClients } = params;
    if (selectedClients.length === 0 && !syncContacts) return;

    cancelledRef.current = false;
    const startedAt = Date.now();

    // Total steps: 1 for contacts (if checked) + 1 for history (global, not per client)
    const contactsStep = syncContacts ? 1 : 0;
    const historySteps = syncHistory ? 1 : 0;
    const totalSteps = contactsStep + historySteps;

    setSyncState({
      syncing: true,
      cancelled: false,
      currentClientName: null,
      currentClientIndex: 0,
      totalClients: totalSteps,
      completedResults: [],
      startedAt,
      progressPct: 0,
      elapsedDisplay: null,
    });

    const results: ClientSyncResult[] = [];
    let completedSteps = 0;

    const updateProgress = (currentName: string, stepIndex: number, subProgress = 0) => {
      const basePct = (completedSteps / totalSteps) * 100;
      const stepPct = (1 / totalSteps) * 100;
      const pct = Math.round(basePct + stepPct * Math.min(subProgress, 0.95));
      const elapsed = Date.now() - startedAt;

      setSyncState((prev) => ({
        ...prev,
        currentClientName: currentName,
        currentClientIndex: completedSteps + 1,
        completedResults: [...results],
        progressPct: pct,
        elapsedDisplay: `Em andamento há ${formatElapsed(elapsed)}`,
      }));
    };

    // 1. Sync contacts (global)
    if (syncContacts && !cancelledRef.current) {
      updateProgress("Contatos (global)", 0);
      try {
        let page = 1;
        let hasMore = true;
        let totalContacts = 0;
        let denominator = 31;
        while (hasMore && !cancelledRef.current) {
          const { data, error } = await supabase.functions.invoke("sync-gist-contacts", {
            body: { page, max_pages: 5 },
          });
          if (error) throw error;
          if (data?.result?.total_pages) denominator = data.result.total_pages;
          totalContacts += data?.result?.contacts_processed ?? 0;
          hasMore = data?.result?.has_more ?? false;
          page = data?.result?.next_page ?? page + 1;
          updateProgress("Contatos (global)", 0, Math.min(page / denominator, 0.95));
          await new Promise((r) => setTimeout(r, 1000));
        }
        results.push({ clientId: "__contacts__", clientName: "Contatos (global)", contacts: totalContacts, messages: 0 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        results.push({ clientId: "__contacts__", clientName: "Contatos (global)", contacts: 0, messages: 0, error: msg });
      }
      completedSteps++;
    }

    // 2. Sync history (single global pass — backend resolves client_id per conversation)
    if (syncHistory && !cancelledRef.current) {
      updateProgress("Histórico (global)", contactsStep);
      let totalMessages = 0;
      try {
        let page = 1;
        let hasMore = true;
        let denominator = 50; // default, updated dynamically
        while (hasMore && !cancelledRef.current) {
          const { data, error } = await supabase.functions.invoke("ingest-gist-historical", {
            body: { page, max_pages: 5 },
          });
          if (error) throw error;
          if (data?.result?.total_pages) denominator = data.result.total_pages;
          totalMessages += data?.result?.messages_inserted ?? 0;
          hasMore = data?.result?.has_more ?? false;
          page = data?.result?.next_page ?? page + 1;
          updateProgress("Histórico (global)", contactsStep, Math.min(page / denominator, 0.95));
          await new Promise((r) => setTimeout(r, 1000));
        }
        results.push({ clientId: "__history__", clientName: "Histórico (global)", contacts: 0, messages: totalMessages });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        results.push({ clientId: "__history__", clientName: "Histórico (global)", contacts: 0, messages: totalMessages, error: msg });
      }
      completedSteps++;
    }

    localStorage.setItem("cx_hub_last_sync", new Date().toISOString());

    // Final state
    setSyncState((prev) => ({
      ...prev,
      syncing: false,
      currentClientName: null,
      completedResults: [...results],
      progressPct: 100,
      elapsedDisplay: null,
    }));

    const totalContacts = results.reduce((s, r) => s + r.contacts, 0);
    const totalMessages = results.reduce((s, r) => s + r.messages, 0);
    const errorCount = results.filter((r) => r.error).length;

    if (cancelledRef.current) {
      toast.info("Sincronização cancelada pelo usuário.");
    } else if (errorCount > 0) {
      toast.warning(`Sincronização concluída com ${errorCount} erro(s) — ${totalContacts} contatos, ${totalMessages} mensagens`);
    } else {
      toast.success(`Sincronização completa — ${totalContacts} contatos, ${totalMessages} mensagens novas`);
    }

    queryClient.invalidateQueries({ queryKey: ["sync_clients"] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }, [queryClient]);

  return (
    <ClientContext.Provider
      value={{
        clients,
        selectedClient,
        setSelectedClient,
        loading: isLoading,
        importing,
        importProgress,
        handleImportHistory,
        syncState,
        runSync,
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
