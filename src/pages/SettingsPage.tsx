import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, MessageCircle, Phone, Hash, Mail, Mic, Download, Loader2, Check, Upload, MoreHorizontal, RefreshCw, X, AlertTriangle, ShieldAlert } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GistContactWizard } from "@/components/GistContactWizard";
import { useAuth } from "@/context/AuthContext";
import { useClient } from "@/context/ClientContext";

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

interface ClientSyncResult {
  clientId: string;
  contacts: number;
  messages: number;
  error?: string;
}

// ── Helpers ──

function formatSyncDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Hoje, ${time}`;
  if (diffDays === 1) return `Ontem, ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${time}`;
}

// ── Component ──────────────────────────────────────────

const SettingsPage = () => {
  const { user } = useAuth();
  const { importing, importProgress, handleImportHistory } = useClient();

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
  const [syncing, setSyncing] = useState(false);
  const [currentClientName, setCurrentClientName] = useState<string | null>(null);
  const [currentClientIndex, setCurrentClientIndex] = useState(0);
  const [completedResults, setCompletedResults] = useState<ClientSyncResult[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [inactiveDays, setInactiveDays] = useState(90);
  const [applyingRule, setApplyingRule] = useState(false);
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
        .eq("active", true)
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

  // Pre-select active clients on mount
  useEffect(() => {
    if (syncClients.length > 0 && selectedClientIds.length === 0) {
      setSelectedClientIds(syncClients.filter((c) => c.active).map((c) => c.id));
    }
  }, [syncClients]);

  // Prevent tab close during sync
  useEffect(() => {
    if (!syncing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [syncing]);

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

  const selectedClients = useMemo(
    () => syncClients.filter((c) => selectedClientIds.includes(c.id)),
    [syncClients, selectedClientIds]
  );

  const syncLabel = useMemo(() => {
    const parts: string[] = [];
    if (syncContacts) parts.push("Contatos");
    if (syncHistory) parts.push("Histórico");
    return parts.join(" + ") || "—";
  }, [syncContacts, syncHistory]);

  const lastSyncRaw = typeof window !== "undefined" ? localStorage.getItem("cx_hub_last_sync") : null;

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

  const runSync = useCallback(async () => {
    if (selectedClients.length === 0) return;
    setSyncing(true);
    setCancelled(false);
    cancelledRef.current = false;
    setCompletedResults([]);
    setCurrentClientIndex(0);

    const results: ClientSyncResult[] = [];

    // sync-gist-contacts is global (not per-client), run once if checked
    if (syncContacts && !cancelledRef.current) {
      setCurrentClientName("Contatos (global)");
      try {
        let page = 1;
        let hasMore = true;
        let totalContacts = 0;
        while (hasMore && !cancelledRef.current) {
          const { data, error } = await supabase.functions.invoke("sync-gist-contacts", {
            body: { page, max_pages: 5 },
          });
          if (error) throw error;
          totalContacts += data?.result?.contacts_processed ?? 0;
          hasMore = data?.result?.has_more ?? false;
          page = data?.result?.next_page ?? page + 1;
          await new Promise((r) => setTimeout(r, 1000));
        }
        results.push({ clientId: "__contacts__", contacts: totalContacts, messages: 0 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        results.push({ clientId: "__contacts__", contacts: 0, messages: 0, error: msg });
      }
    }

    // ingest-gist-historical per selected client
    if (syncHistory) {
      for (let i = 0; i < selectedClients.length; i++) {
        if (cancelledRef.current) break;
        const client = selectedClients[i];
        setCurrentClientName(client.name);
        setCurrentClientIndex(i + 1);

        let totalMessages = 0;
        try {
          let page = 1;
          let hasMore = true;
          while (hasMore && !cancelledRef.current) {
            const { data, error } = await supabase.functions.invoke("ingest-gist-historical", {
              body: { page, max_pages: 5, client_id: client.id },
            });
            if (error) throw error;
            totalMessages += data?.result?.messages_inserted ?? 0;
            hasMore = data?.result?.has_more ?? false;
            page = data?.result?.next_page ?? page + 1;
            await new Promise((r) => setTimeout(r, 1000));
          }
          results.push({ clientId: client.id, contacts: 0, messages: totalMessages });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro desconhecido";
          results.push({ clientId: client.id, contacts: 0, messages: totalMessages, error: msg });
        }
        setCompletedResults([...results]);
      }
    }

    localStorage.setItem("cx_hub_last_sync", new Date().toISOString());
    setSyncing(false);
    setCurrentClientName(null);

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
  }, [selectedClients, syncContacts, syncHistory]);

  const handleCancel = () => {
    cancelledRef.current = true;
    setCancelled(true);
  };

  const progressPct = syncing && syncHistory && selectedClients.length > 0
    ? Math.round((currentClientIndex / selectedClients.length) * 100)
    : syncing ? 50 : 0;

  // ── Inactivation rule handler ──

  const handleApplyInactivationRule = useCallback(async () => {
    if (inactiveDays < 1) {
      toast.error("O número de dias deve ser pelo menos 1.");
      return;
    }
    setApplyingRule(true);
    try {
      const { data, error } = await supabase.rpc("deactivate_stale_clients", { _days: inactiveDays });
      if (error) throw error;
      const count = typeof data === "number" ? data : 0;
      toast.success(`${count} cliente(s) inativado(s).`);
      queryClient.invalidateQueries({ queryKey: ["sync_clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao aplicar regra: " + msg);
    } finally {
      setApplyingRule(false);
    }
  }, [inactiveDays, queryClient]);

  // ── Integration cards config ──

  const integrations = [
    { id: "gist", name: "Gist", icon: MessageCircle, connected: hasGist, enabled: true },
    { id: "whatsapp", name: "WhatsApp", icon: Phone, connected: false, enabled: false },
    { id: "discord", name: "Discord", icon: Hash, connected: false, enabled: false },
    { id: "email", name: "Email", icon: Mail, connected: false, enabled: false },
    { id: "transcription", name: "Transcrição", icon: Mic, connected: false, enabled: false },
  ];

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
        </TabsList>

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

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {integ.id === "gist" && integ.connected ? (
                          <>
                            <DropdownMenuItem onClick={handleImportHistory} disabled={importing}>
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
                          </>
                        ) : (
                          <DropdownMenuItem disabled>Em breve...</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Import progress */}
          {importProgress && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-sm space-y-1">
                {!importProgress.done ? (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando página {importProgress.currentPage}...
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {importProgress.conversationsTotal} conversas | {importProgress.messagesTotal} mensagens importadas
                    </p>
                  </>
                ) : importProgress.error ? (
                  <p className="text-destructive">Erro: {importProgress.error}</p>
                ) : (
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4" />
                    Importação concluída: {importProgress.conversationsTotal} conversas, {importProgress.messagesTotal} mensagens
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ Tab: Sincronização ═══ */}
        <TabsContent value="sync" className="mt-4 space-y-6">
          {/* Warning banner during sync */}
          {syncing && (
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 font-medium">
                ⚠ Sincronização em andamento. Não navegue para outra página.
              </AlertDescription>
            </Alert>
          )}

          {/* Title + last sync */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sincronização de Dados</h2>
            <p className="text-sm text-muted-foreground">
              Selecione os clientes e o que deseja sincronizar, depois clique em Executar.
            </p>
          </div>

          {lastSyncRaw && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Última sincronização completa: {formatSyncDate(lastSyncRaw)}
            </div>
          )}

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
                Aplica apenas a clientes criados automaticamente (auto_created = true)
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
                onClick={handleApplyInactivationRule}
                disabled={applyingRule}
                className="ml-auto"
              >
                {applyingRule ? (
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
                    Sincronizando{syncHistory ? ` cliente ${currentClientIndex} de ${selectedClients.length}` : ""}: {currentClientName}...
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCancel} className="text-xs text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Per-client status list */}
                {syncHistory && (
                  <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                    {selectedClients.map((client, idx) => {
                      const result = completedResults.find((r) => r.clientId === client.id);
                      const isCurrent = idx + 1 === currentClientIndex;
                      const isPending = !result && !isCurrent;

                      return (
                        <div key={client.id} className="flex items-center gap-2 py-0.5">
                          {result ? (
                            result.error ? (
                              <span className="text-destructive text-xs">✗</span>
                            ) : (
                              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            )
                          ) : isCurrent ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                          ) : (
                            <span className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground text-xs">○</span>
                          )}
                          <span className={`${isCurrent ? "font-medium text-foreground" : result ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                            {client.name}
                          </span>
                          {result && !result.error && (
                            <span className="text-xs text-muted-foreground ml-auto tabular-nums">{result.messages.toLocaleString("pt-BR")} msgs</span>
                          )}
                          {result?.error && (
                            <span className="text-xs text-destructive ml-auto">erro</span>
                          )}
                          {isCurrent && (
                            <span className="text-xs text-muted-foreground ml-auto">em andamento...</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3 — Execute bar */}
          <div className="sticky bottom-0 bg-background border-t border-border -mx-6 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedClientIds.length} clientes selecionados · {syncLabel}
            </p>
            <Button
              onClick={runSync}
              disabled={syncing || selectedClientIds.length === 0 || (!syncContacts && !syncHistory)}
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
      </Tabs>

      {/* ── Contact Wizard ── */}
      <GistContactWizard open={wizardOpen} onClose={() => setWizardOpen(false)} mode="update-contacts" />
    </div>
  );
};

export default SettingsPage;
