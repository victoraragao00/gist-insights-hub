import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, MessageCircle, Phone, Hash, Mail, Mic, Download, Loader2, Check, Upload, MoreHorizontal, RefreshCw, X, ShieldAlert, RotateCcw, Clock, CheckCircle2, XCircle, AlertTriangle, CalendarClock } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GistContactWizard } from "@/components/GistContactWizard";
import { useAuth } from "@/context/AuthContext";
import { useClient, type SyncJobRecord } from "@/context/ClientContext";
import { useUserRole } from "@/hooks/useUserRole";
import { ColumnSettingsTab } from "@/components/demands/ColumnSettingsTab";
import { AreaSettingsTab } from "@/components/demands/AreaSettingsTab";
import { UserManagementTab } from "@/components/settings/UserManagementTab";

// ── Types ──────────────────────────────────────────────

interface ChannelBinding {
  id: string;
  client_id: string;
  channel: string;
  label: string | null;
  active: boolean | null;
}

interface ClientOption {
  id: string;
  name: string;
}

interface SyncClient {
  id: string;
  name: string;
  slug: string;
  active: boolean | null;
  metadata: Record<string, unknown> | null;
}

// ── Helpers ──

function formatSyncDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, now)) return `Hoje, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) return `Ontem, ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${time}`;
}

function jobTypeLabel(type: string): string {
  switch (type) {
    case 'sync_contacts': return 'Contatos';
    case 'ingest_historical': return 'Histórico';
    default: return type;
  }
}

function jobStatusBadge(status: string) {
  switch (status) {
    case 'pending': return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    case 'running': return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Executando</Badge>;
    case 'completed': return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
    case 'failed': return <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
    case 'cancelled': return <Badge variant="outline" className="text-xs bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground"><X className="h-3 w-3 mr-1" />Cancelado</Badge>;
    default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

// ── Prioridades (admin only) ────────────────────────────

type ClientTier = "azzas" | "enterprise" | "medium" | "small";

interface PriorityConfigRow {
  client_id: string;
  client_name: string;
  client_slug: string;
  config_id: string | null;
  tier: ClientTier;
  weight_multiplier: number;
}

function SettingsPrioritiesTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ["clients_priority", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug")
        .in("status", ["ativo", "trial"])
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; slug: string }[];
    },
  });

  const { data: configs = [] } = useQuery<{ id: string; client_id: string; tier: ClientTier; weight_multiplier: number }[]>({
    queryKey: ["client_priority_config", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_priority_config")
        .select("id, client_id, tier, weight_multiplier");
      if (error) throw error;
      return (data ?? []) as { id: string; client_id: string; tier: ClientTier; weight_multiplier: number }[];
    },
  });

  const rows: PriorityConfigRow[] = useMemo(() => {
    const byClient = new Map<string, { id: string; tier: ClientTier; weight_multiplier: number }>();
    configs.forEach((c) => byClient.set(c.client_id, { id: c.id, tier: c.tier, weight_multiplier: c.weight_multiplier }));
    return clients.map((c) => {
      const cfg = byClient.get(c.id);
      return {
        client_id: c.id,
        client_name: c.name,
        client_slug: c.slug,
        config_id: cfg?.id ?? null,
        tier: cfg?.tier ?? "medium",
        weight_multiplier: cfg?.weight_multiplier ?? 1,
      };
    });
  }, [clients, configs]);

  const saveMutation = useMutation({
    mutationFn: async ({ client_id, tier, weight_multiplier }: { client_id: string; tier: ClientTier; weight_multiplier: number }) => {
      const { error } = await supabase.from("client_priority_config").upsert(
        {
          client_id,
          tier,
          weight_multiplier,
          updated_at: new Date().toISOString(),
          recurrence_threshold_users: 3,
          recurrence_window_days: 15,
          active: true,
        },
        { onConflict: "client_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client_priority_config"] });
      queryClient.invalidateQueries({ queryKey: ["priority-scores"] });
      toast.success("Prioridade atualizada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const [editing, setEditing] = useState<Record<string, { tier: ClientTier; weight_multiplier: number }>>({});

  const getEdit = (row: PriorityConfigRow) =>
    editing[row.client_id] ?? { tier: row.tier, weight_multiplier: row.weight_multiplier };
  const setEdit = (clientId: string, next: { tier: ClientTier; weight_multiplier: number }) =>
    setEditing((prev) => ({ ...prev, [clientId]: next }));

  return (
    <div className="space-y-4 mt-4">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tier e peso por cliente</CardTitle>
          <CardDescription>
            Altere o tier e o multiplicador de peso. Os scores são recalculados periodicamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const edit = getEdit(row);
                const isDirty =
                  edit.tier !== row.tier || edit.weight_multiplier !== row.weight_multiplier;
                return (
                  <TableRow key={row.client_id}>
                    <TableCell>
                      <span className="font-medium text-sm">{row.client_name}</span>
                      <p className="text-xs text-muted-foreground">{row.client_slug}</p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={edit.tier}
                        onValueChange={(v) => setEdit(row.client_id, { ...edit, tier: v as ClientTier })}
                      >
                        <SelectTrigger className="w-36 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="azzas">azzas</SelectItem>
                          <SelectItem value="enterprise">enterprise</SelectItem>
                          <SelectItem value="medium">medium</SelectItem>
                          <SelectItem value="small">small</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        className="w-24 h-9"
                        value={edit.weight_multiplier}
                        onChange={(e) =>
                          setEdit(row.client_id, {
                            ...edit,
                            weight_multiplier: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        disabled={!isDirty || saveMutation.isPending}
                        onClick={() => {
                          saveMutation.mutate(
                            {
                              client_id: row.client_id,
                              tier: edit.tier,
                              weight_multiplier: edit.weight_multiplier,
                            },
                            {
                              onSuccess: () =>
                                setEditing((prev) => {
                                  const next = { ...prev };
                                  delete next[row.client_id];
                                  return next;
                                }),
                            }
                          );
                        }}
                      >
                        {saveMutation.isPending && (saveMutation.variables as { client_id: string } | undefined)?.client_id === row.client_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Auto-Sync Card ──────────────────────────────────────

function AutoSyncCard() {
  const queryClient = useQueryClient();

  const { data: autoSyncEnabled, isLoading } = useQuery<boolean>({
    queryKey: ["app_settings", "auto_sync_enabled"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "auto_sync_enabled")
        .single();
      if (error) throw error;
      const val = data?.value;
      return val === true || val === "true";
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: enabled, updated_at: new Date().toISOString() })
        .eq("key", "auto_sync_enabled");
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["app_settings", "auto_sync_enabled"] });
      toast.success(enabled ? "Agendamento automático ativado" : "Agendamento automático desativado");
    },
    onError: () => {
      toast.error("Erro ao alterar configuração");
    },
  });

  const enabled = autoSyncEnabled ?? false;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Agendamento Automático</CardTitle>
            <Badge variant={enabled ? "default" : "outline"} className="text-xs">
              {enabled ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => toggleMutation.mutate(checked)}
            disabled={isLoading || toggleMutation.isPending}
          />
        </div>
        <CardDescription className="text-xs">
          Sincronização automática de contatos e histórico durante horário comercial.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-1">
        <p>📅 Seg-Sex, 08:00–19:00 (a cada 5 min) + 23:59</p>
        <p>🔄 Incremental — processa apenas dados novos desde a última execução</p>
        <p>🛡️ Duplicatas são prevenidas automaticamente</p>
      </CardContent>
    </Card>
  );
}

// ── Component ──────────────────────────────────────────

const SettingsPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { syncState, startSync, cancelSync } = useClient();

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);

  // Upload state
  const [uploadClientId, setUploadClientId] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync tab state
  const [syncContacts, setSyncContacts] = useState(true);
  const [syncHistory, setSyncHistory] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [inactiveDays, setInactiveDays] = useState(90);
  const queryClient = useQueryClient();

  // ── Queries ──

  const { data: gistBindings = [] } = useQuery<ChannelBinding[]>({
    queryKey: ["gist_bindings", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_bindings")
        .select("id, client_id, channel, label, active")
        .eq("channel", "gist")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ChannelBinding[];
    },
  });

  const hasGist = gistBindings.length > 0;

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ["clients_list", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .in("status", ["ativo", "trial"])
        .order("name")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ClientOption[];
    },
  });

  // Sync tab: full client list
  const { data: syncClients = [] } = useQuery<SyncClient[]>({
    queryKey: ["sync_clients", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, metadata")
        .order("name")
        .limit(300);
      if (error) throw error;
      return (data ?? []) as SyncClient[];
    },
  });

  // Interaction counts per client
  const { data: interactionCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["sync_interaction_counts", user?.id, syncClients.length],
    enabled: syncClients.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("client_id")
        .limit(5000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.client_id] = (counts[row.client_id] || 0) + 1;
      }
      return counts;
    },
  });

  // Job history
  const { data: jobHistory = [] } = useQuery<SyncJobRecord[]>({
    queryKey: ["sync_jobs_history", user?.id],
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as SyncJobRecord[];
    },
  });

  // Realtime: auto-refresh job history on INSERT/UPDATE
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('job-history-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_jobs' }, () => {
        queryClient.invalidateQueries({ queryKey: ["sync_jobs_history"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  // Pre-select active clients on mount
  useEffect(() => {
    if (syncClients.length > 0 && selectedClientIds.length === 0) {
      setSelectedClientIds(syncClients.filter((c) => c.active).map((c) => c.id));
    }
  }, [syncClients]);

  // Filtered clients for display
  const filteredClients = useMemo(() => {
    if (statusFilter === "active") return syncClients.filter((c) => c.active);
    if (statusFilter === "inactive") return syncClients.filter((c) => !c.active);
    return syncClients;
  }, [syncClients, statusFilter]);

  const activeCount = useMemo(() => syncClients.filter((c) => c.active).length, [syncClients]);
  const inactiveCount = useMemo(() => syncClients.filter((c) => !c.active).length, [syncClients]);

  // ── Upload handler ──

  const handleUpload = () => {
    toast.info("Em breve: importação de transcrições será implementada.");
  };

  const canUpload =
    uploadClientId && uploadSource && uploadDate && fileInputRef.current?.files?.length;

  // ── Sync logic ──

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectActive = () => setSelectedClientIds(filteredClients.filter((c) => c.active).map((c) => c.id));
  const selectAll = () => setSelectedClientIds((prev) => {
    const filteredIds = new Set(filteredClients.map((c) => c.id));
    const otherSelected = prev.filter((id) => !filteredIds.has(id));
    return [...otherSelected, ...filteredClients.map((c) => c.id)];
  });
  const clearSelection = () => {
    const filteredIds = new Set(filteredClients.map((c) => c.id));
    setSelectedClientIds((prev) => prev.filter((id) => !filteredIds.has(id)));
  };

  const syncLabel = useMemo(() => {
    const parts: string[] = [];
    if (syncContacts) parts.push("Contatos");
    if (syncHistory) parts.push("Histórico");
    return parts.join(" + ") || "—";
  }, [syncContacts, syncHistory]);

  const lastSyncDate = useMemo(() => {
    const completed = jobHistory.find(j => j.status === 'completed');
    return completed?.completed_at ?? null;
  }, [jobHistory]);

  const handleToggleContacts = (checked: boolean) => {
    if (!checked && !syncHistory) {
      setSyncError("Selecione pelo menos uma opção.");
      return;
    }
    setSyncError(null);
    setSyncContacts(checked);
  };

  const handleToggleHistory = (checked: boolean) => {
    if (!checked && !syncContacts) {
      setSyncError("Selecione pelo menos uma opção.");
      return;
    }
    setSyncError(null);
    setSyncHistory(checked);
  };

  const handleRunSync = () => {
    startSync({ syncContacts, syncHistory });
  };

  // ── Retry handler ──
  const handleRetryJob = useCallback(async (jobId: string) => {
    const { error } = await supabase
      .from('sync_jobs')
      .update({
        status: 'pending',
        retry_count: 0,
        completed_at: null,
        heartbeat_at: null,
      })
      .eq('id', jobId);
    if (error) {
      toast.error("Erro ao retentar: " + error.message);
    } else {
      toast.success("Job reenfileirado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["sync_jobs_history"] });
    }
  }, [queryClient]);

  // ── Import history (creates job directly) ──
  const handleImportHistory = useCallback(() => {
    startSync({ syncContacts: false, syncHistory: true });
  }, [startSync]);

  // ── Inactivation rule mutation ──

  const applyInactivationRuleMutation = useMutation({
    mutationFn: async (days: number) => {
      if (days < 1) throw new Error("O número de dias deve ser pelo menos 1.");
      const { data, error } = await supabase.rpc("deactivate_stale_clients", { _days: days });
      if (error) throw error;
      return typeof data === "number" ? data : 0;
    },
    onSuccess: (count) => {
      toast.success(`${count} cliente(s) inativado(s).`);
      queryClient.invalidateQueries({ queryKey: ["sync_clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    },
  });

  // ── Integration cards config ──

  const integrations = [
    { id: "gist", name: "Gist", icon: MessageCircle, connected: hasGist, enabled: true },
    { id: "whatsapp", name: "WhatsApp", icon: Phone, connected: false, enabled: false },
    { id: "discord", name: "Discord", icon: Hash, connected: false, enabled: false },
    { id: "email", name: "Email", icon: Mail, connected: false, enabled: false },
    { id: "transcription", name: "Transcrição", icon: Mic, connected: false, enabled: false },
  ];

  const { syncing } = syncState;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie integrações globais e uploads de dados</p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          {isAdmin && <TabsTrigger value="priorities">Prioridades</TabsTrigger>}
          {isAdmin && <TabsTrigger value="columns">Colunas</TabsTrigger>}
          {isAdmin && <TabsTrigger value="areas">Áreas</TabsTrigger>}
          {isAdmin && <TabsTrigger value="users">Equipe & Acessos</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="priorities" className="mt-4">
            <SettingsPrioritiesTab />
          </TabsContent>
        )}

        {/* ═══ Tab: Integrações ═══ */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integ) => (
              <Card key={integ.id} className={`border shadow-sm ${!integ.enabled ? "opacity-60" : ""}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                      <integ.icon className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <span className="font-semibold text-sm">{integ.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={integ.connected ? "default" : "outline"} className="text-xs">
                      {integ.connected ? "Conectado" : integ.enabled ? "Desconectado" : "Em breve"}
                    </Badge>

                    {integ.enabled && integ.id === "gist" && integ.connected && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleImportHistory} disabled={syncing}>
                            <Download className="h-4 w-4 mr-2" />
                            Importar Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setWizardOpen(true)}>
                            <Users className="h-4 w-4 mr-2" />
                            Gerenciar Contatos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled>
                            Configurar Webhook
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
                            Desconectar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ Tab: Sincronização ═══ */}
        <TabsContent value="sync" className="mt-4 space-y-6">
          {/* Title + last sync */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sincronização de Dados</h2>
            <p className="text-sm text-muted-foreground">
              Selecione o que deseja sincronizar e clique em Executar. O processamento acontece em segundo plano.
            </p>
          </div>

          {lastSyncDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Última sincronização completa: {formatSyncDate(lastSyncDate)}
            </div>
          )}

          {/* Auto-sync schedule */}
          <AutoSyncCard />

          {/* Step 1 — What to sync */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">O que sincronizar</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggleContacts(!syncContacts)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                  syncContacts ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Checkbox
                  checked={syncContacts}
                  onCheckedChange={(c) => handleToggleContacts(!!c)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Contatos</p>
                  <p className="text-xs text-muted-foreground">Atualiza participantes e last_seen_at via Gist</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleHistory(!syncHistory)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                  syncHistory ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <Checkbox
                  checked={syncHistory}
                  onCheckedChange={(c) => handleToggleHistory(!!c)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Histórico de mensagens</p>
                  <p className="text-xs text-muted-foreground">Importa novas mensagens do Gist para cada cliente</p>
                </div>
              </button>
            </div>
            {syncError && (
              <p className="text-xs text-destructive">{syncError}</p>
            )}
          </div>

          {/* Inactivation Rule Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Regra de Inativação Automática</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Inativa clientes criados automaticamente (via sincronização) sem acesso no período configurado.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-foreground whitespace-nowrap">Inativar clientes sem acesso há mais de</span>
              <Input
                type="number"
                min={1}
                value={inactiveDays}
                onChange={(e) => setInactiveDays(Math.max(1, parseInt(e.target.value) || 90))}
                className="w-20 h-8 text-center"
              />
              <span className="text-sm text-foreground">dias</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyInactivationRuleMutation.mutate(inactiveDays)}
                disabled={applyInactivationRuleMutation.isPending}
                className="ml-auto"
              >
                {applyInactivationRuleMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Aplicando...</>
                ) : (
                  "Aplicar regra agora"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Step 2 — Select clients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-foreground">Clientes</h3>
                {/* Status filter */}
                <div className="flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("active")}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Ativos ({activeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("inactive")}
                    className={`px-3 py-1 text-xs font-medium transition-colors border-x border-border ${
                      statusFilter === "inactive"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Inativos ({inactiveCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Todos ({syncClients.length})
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectActive}>
                  Selecionar ativos
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
                  Selecionar todos
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                  Limpar seleção
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Interações</TableHead>
                      <TableHead>Último acesso Gist</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => {
                      const meta = (client.metadata ?? {}) as Record<string, unknown>;
                      const lastSeen = meta.last_seen_at as string | undefined;
                      const isSelected = selectedClientIds.includes(client.id);

                      return (
                        <TableRow
                          key={client.id}
                          className={`cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                          onClick={() => toggleClient(client.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleClient(client.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{client.slug}</TableCell>
                          <TableCell>
                            <Badge
                              variant={client.active ? "default" : "outline"}
                              className={`text-xs ${client.active ? "bg-primary/10 text-primary border-0" : ""}`}
                            >
                              {client.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {interactionCounts[client.id] ?? 0}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {lastSeen ? formatSyncDate(lastSeen) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredClients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Progress panel (shown while syncing) */}
          {syncing && (
            <Card className="border border-primary/20 bg-primary/5 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Sincronizando: {syncState.currentLabel ?? "Preparando..."}
                    {syncState.elapsedDisplay && (
                      <span className="text-muted-foreground">— {syncState.elapsedDisplay}</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={cancelSync} className="text-xs text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${syncState.progressPct}%` }}
                  />
                </div>

                {/* Per-job status */}
                {syncState.jobs.length > 0 && (
                  <div className="space-y-1 text-sm">
                    {syncState.jobs.map((job) => (
                      <div key={job.id} className="flex items-center gap-2 py-0.5">
                        {job.status === 'completed' ? (
                          <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : job.status === 'failed' ? (
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        )}
                        <span className="text-muted-foreground">{jobTypeLabel(job.type)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job History */}
          {jobHistory.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Histórico de Jobs</h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobHistory.map((job) => {
                      const progress = (job.progress ?? {}) as Record<string, unknown>;
                      const contacts = (progress.contacts_processed as number) || 0;
                      const messages = (progress.messages_inserted as number) || 0;
                      const duration = job.started_at && job.completed_at
                        ? Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                        : null;

                      return (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium text-sm">{jobTypeLabel(job.type)}</TableCell>
                          <TableCell>{jobStatusBadge(job.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatSyncDate(job.created_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground tabular-nums">
                            {duration !== null ? `${duration}s` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {job.type === 'sync_contacts' && contacts > 0 && `${contacts} contatos`}
                            {job.type === 'ingest_historical' && messages > 0 && `${messages} msgs`}
                          </TableCell>
                          <TableCell>
                            {job.status === 'failed' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleRetryJob(job.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Retentar</TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Step 3 — Execute bar */}
          <div className="sticky bottom-0 bg-background border-t border-border -mx-6 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {syncLabel}
            </p>
            <Button
              onClick={handleRunSync}
              disabled={syncing || (!syncContacts && !syncHistory)}
              className="gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Executar sincronização
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ═══ Tab: Uploads ═══ */}
        <TabsContent value="uploads" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Upload de Transcrições</CardTitle>
              <CardDescription>Importe arquivos de transcrição de reuniões (.txt, .vtt, .csv)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={uploadClientId} onValueChange={setUploadClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <Select value={uploadSource} onValueChange={setUploadSource}>
                    <SelectTrigger><SelectValue placeholder="Selecione a fonte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Gemini</SelectItem>
                      <SelectItem value="tactiq">Tactiq</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data da Reunião</Label>
                  <Input type="date" value={uploadDate} onChange={(e) => setUploadDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <Input ref={fileInputRef} type="file" accept=".txt,.vtt,.csv" />
                </div>
              </div>

              <Button onClick={handleUpload} disabled={!canUpload}>
                <Upload className="h-4 w-4 mr-1" /> Importar Transcrição
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Columns Tab ── */}
        {isAdmin && (
          <TabsContent value="columns">
            <ColumnSettingsTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="users">
            <UserManagementTab />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Contact Wizard ── */}
      <GistContactWizard open={wizardOpen} onClose={() => setWizardOpen(false)} mode="update-contacts" />
    </div>
  );
};

export default SettingsPage;
