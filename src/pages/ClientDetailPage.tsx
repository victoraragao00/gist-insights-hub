import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Pencil, MoreHorizontal, Loader2, Upload } from "lucide-react";
import { InteractionsFeed } from "@/components/InteractionsFeed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

// ── Types ──

interface ClientMetadata {
  scope?: string;
  monitored_themes?: string[];
  governance_rules?: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    active: boolean;
  }>;
  sla?: {
    hours_start: string;
    hours_end: string;
    response_time_minutes: number;
    working_days: string;
  };
  documents?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size_kb: number;
    category: string[];
    created_at: string;
  }>;
  last_seen_at?: string;
  auto_created?: boolean;
}

interface ClientDetail {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  metadata: ClientMetadata | null;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  role: string | null;
  side: string;
  identifiers: Array<{ channel: string; value: string }> | null;
  active: boolean | null;
}

interface ChannelBinding {
  id: string;
  channel: string;
  channel_identifier: string;
  label: string | null;
  active: boolean | null;
}

interface Interaction {
  id: string;
  tone: string | null;
  occurred_at: string;
  sender_raw: string | null;
  sender_side: string | null;
  content: string | null;
  channel: string;
  is_out_of_scope: boolean | null;
}

interface AuditRule {
  id: string;
  metric: string;
  name: string;
  active: boolean | null;
}

// ── Helpers ──

const TONE_CONFIG: Record<string, { label: string; className: string }> = {
  ok: { label: "✓ Ok", className: "bg-green-100 text-green-700" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-100 text-yellow-700" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-100 text-orange-700" },
  critico: { label: "🔴 Crítico", className: "bg-red-100 text-red-700" },
};

const CHANNEL_ICONS: Record<string, string> = {
  gist: "💬", whatsapp: "📱", email: "📧", discord: "🟣",
  transcription_gemini: "🎙", transcription_tactiq: "🎙", manual: "📝",
};

const CHANNEL_LABELS: Record<string, string> = {
  gist: "Gist", whatsapp: "WhatsApp", email: "Email", discord: "Discord",
  transcription_gemini: "Transcrições (Gemini)", transcription_tactiq: "Transcrições (Tactiq)", manual: "Manual",
};

const DOC_ICONS: Record<string, string> = {
  pdf: "📄", xlsx: "📊", xls: "📊", docx: "📋", doc: "📋",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hoje, ${time}`;
  if (diffDays === 1) return `Ontem, ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${time}`;
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (diffMinutes < 1) return "agora mesmo";
  if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes > 1 ? "s" : ""}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  if (diffDays === 0) return `hoje às ${time}`;
  if (diffDays === 1) return `ontem às ${time}`;
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

// ── Component ──

const ClientDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [scopeText, setScopeText] = useState<string | null>(null);
  const [savingScope, setSavingScope] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const thirtyDaysAgo = useMemo(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), []
  );

  // ── Queries ──

  const { data: client, isLoading: loadingClient } = useQuery<ClientDetail | null>({
    queryKey: ["client_detail", slug, user?.id],
    enabled: !!slug && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, metadata, created_at")
        .eq("slug", slug!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ClientDetail | null;
    },
  });

  const clientId = client?.id;
  const meta = (client?.metadata ?? {}) as ClientMetadata;

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["detail_participants", clientId, user?.id],
    enabled: !!clientId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, role, side, identifiers, active")
        .eq("client_id", clientId!)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Participant[];
    },
  });

  const { data: bindings = [] } = useQuery<ChannelBinding[]>({
    queryKey: ["detail_bindings", clientId, user?.id],
    enabled: !!clientId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_bindings")
        .select("id, channel, channel_identifier, label, active")
        .eq("client_id", clientId!)
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ChannelBinding[];
    },
  });

  const { data: interactions = [] } = useQuery<Interaction[]>({
    queryKey: ["detail_interactions_30d", clientId, user?.id, thirtyDaysAgo],
    enabled: !!clientId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("id, tone, occurred_at, sender_raw, sender_side, content, channel, is_out_of_scope")
        .eq("client_id", clientId!)
        .gte("occurred_at", thirtyDaysAgo)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Interaction[];
    },
  });

  const { data: auditRules = [] } = useQuery<AuditRule[]>({
    queryKey: ["detail_audit_rules", clientId, user?.id],
    enabled: !!clientId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_rules")
        .select("id, metric, name, active")
        .eq("client_id", clientId!)
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditRule[];
    },
  });

  const { data: totalInteractionsCount = 0 } = useQuery<number>({
    queryKey: ["detail_total_interactions", clientId, user?.id],
    enabled: !!clientId && !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // ── Computed stats ──

  const stats = useMemo(() => {
    const total = interactions.length;
    if (total === 0) return { total_30d: 0, dominant_tone: "ok", out_of_scope_pct: 0, last_contact: null as string | null };

    const toneCounts: Record<string, number> = {};
    let oosCount = 0;
    interactions.forEach((i) => {
      const t = i.tone ?? "ok";
      toneCounts[t] = (toneCounts[t] || 0) + 1;
      if (i.is_out_of_scope) oosCount++;
    });

    let dominant = "ok";
    let maxC = 0;
    for (const [t, c] of Object.entries(toneCounts)) {
      if (t !== "ok" && c > maxC) { dominant = t; maxC = c; }
    }
    if (maxC === 0) dominant = "ok";

    return {
      total_30d: total,
      dominant_tone: dominant,
      out_of_scope_pct: Math.round((oosCount / total) * 100),
      last_contact: interactions[0]?.occurred_at ?? null,
    };
  }, [interactions]);

  // 14-day volume
  const volumeData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    interactions.forEach((i) => {
      const key = i.occurred_at.slice(0, 10);
      if (key in days) days[key]++;
    });
    const entries = Object.entries(days);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, max };
  }, [interactions]);

  // Tone distribution
  const toneDistribution = useMemo(() => {
    const counts: Record<string, number> = { ok: 0, atencao: 0, alerta: 0, critico: 0 };
    interactions.forEach((i) => {
      const t = i.tone ?? "ok";
      if (t in counts) counts[t]++;
    });
    const total = interactions.length || 1;
    return Object.entries(counts).map(([tone, count]) => ({
      tone, count, pct: Math.round((count / total) * 100),
    }));
  }, [interactions]);

  // Non-ok interactions (last 5)
  const nonOkInteractions = useMemo(
    () => interactions.filter((i) => i.tone && i.tone !== "ok").slice(0, 5),
    [interactions]
  );

  // Initialize scope from metadata
  if (scopeText === null && client) {
    setScopeText(meta.scope ?? "");
  }

  // ── Actions ──

  const handleSaveScope = async () => {
    if (!client) return;
    setSavingScope(true);
    try {
      const existing = (client.metadata ?? {}) as Record<string, unknown>;
      const { error } = await supabase
        .from("clients")
        .update({ metadata: { ...existing, scope: scopeText } })
        .eq("id", client.id);
      if (error) throw error;
      toast.success("Escopo salvo!");
      queryClient.invalidateQueries({ queryKey: ["client_detail", slug] });
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : "Erro"));
    } finally {
      setSavingScope(false);
    }
  };

  const handleDeactivate = async () => {
    if (!client) return;
    setDeactivating(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ active: false })
        .eq("id", client.id);
      if (error) throw error;
      toast.success("Cliente desativado");
      navigate("/clients");
    } catch (err) {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro"));
    } finally {
      setDeactivating(false);
    }
  };

  const handleToggleRule = async (ruleId: string, active: boolean) => {
    const { error } = await supabase
      .from("audit_rules")
      .update({ active })
      .eq("id", ruleId);
    if (error) {
      toast.error("Erro ao atualizar regra");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["detail_audit_rules", clientId] });
  };

  // ── Loading / Not found ──

  if (loadingClient) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Cliente não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/clients")}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  const dominantTone = TONE_CONFIG[stats.dominant_tone] ?? TONE_CONFIG.ok;
  const clientTeam = participants.filter((p) => p.side === "client");
  const umodeTeam = participants.filter((p) => p.side === "umode");
  const connectedChannels = bindings.map((b) => b.channel);
  const disconnectedChannels = ["whatsapp", "email", "discord", "transcription_gemini"]
    .filter((ch) => !connectedChannels.includes(ch));
  const documents = meta.documents ?? [];
  const governanceRules = meta.governance_rules ?? [];
  const monitoredThemes = meta.monitored_themes ?? [];
  const sla = meta.sla;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/clients" className="hover:text-foreground transition-colors">Clientes</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{client.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">Ativo</Badge>
            <Badge variant="outline" className={`text-xs border-0 ${dominantTone.className}`}>
              {dominantTone.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            slug: {client.slug} · {bindings.length} canais · Atualizado {stats.last_contact ? formatDate(stats.last_contact) : "—"}{" "}
            <span className="inline-flex items-center gap-1 ml-2 text-muted-foreground/70">
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
              Gist sync: automático (6h)
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("Em breve")}>Exportar dados</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="interactions">Interações</TabsTrigger>
          <TabsTrigger value="participants">Participantes ({participants.length})</TabsTrigger>
          <TabsTrigger value="channels">Canais ({bindings.length})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="rules">Regras de Negócio</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger
            value="tasks"
            disabled
            className="opacity-50 cursor-not-allowed"
            onClick={() => toast.info("Gestão de tarefas em breve no CX Hub")}
          >
            Tasks 🔒
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Visão Geral ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard label="Total de Interações" value={String(totalInteractionsCount)} sub="histórico completo" />
            <KPICard label="Interações 30d" value={String(stats.total_30d)} sub="últimos 30 dias" />
            <KPICard label="Tom predominante" value={dominantTone.label} sub="maior frequência" />
            <KPICard label="Fora de escopo %" value={`${stats.out_of_scope_pct}%`} sub="do total de interações" />
            <KPICard
              label="Último Acesso Gist"
              value={meta.last_seen_at ? formatDate(meta.last_seen_at) : "Não disponível"}
              sub={meta.last_seen_at ? `atualizado ${formatRelativeTime(meta.last_seen_at)}` : "sem dados"}
            />
            <KPICard label="Tempo médio resposta" value="Em breve" sub="funcionalidade futura" />
          </div>

          {/* Volume Chart */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Volume de interações (últimos 14 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24">
                {volumeData.entries.map(([day, count]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary/70 rounded-sm min-h-px transition-all"
                      style={{ height: `${(count / volumeData.max) * 80}px` }}
                      title={`${day}: ${count}`}
                    />
                    <span className="text-[10px] text-muted-foreground">{day.slice(8)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tone Distribution */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Distribuição de tom</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {toneDistribution.map(({ tone, pct }) => {
                  const colors: Record<string, string> = {
                    ok: "bg-green-500", atencao: "bg-yellow-500", alerta: "bg-orange-500", critico: "bg-red-500",
                  };
                  return pct > 0 ? (
                    <div key={tone} className={`${colors[tone] ?? "bg-muted"} transition-all`} style={{ width: `${pct}%` }} />
                  ) : null;
                })}
              </div>
              <div className="flex gap-4 text-xs">
                {toneDistribution.map(({ tone, pct }) => {
                  const cfg = TONE_CONFIG[tone];
                  return (
                    <span key={tone} className="text-muted-foreground">
                      {cfg?.label ?? tone} {pct}%
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent non-ok */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Últimas ocorrências de tom não-ok</CardTitle>
            </CardHeader>
            <CardContent>
              {nonOkInteractions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ocorrência recente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Remetente</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Tom</TableHead>
                      <TableHead>Canal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nonOkInteractions.map((i) => {
                      const tCfg = TONE_CONFIG[i.tone ?? "ok"] ?? TONE_CONFIG.ok;
                      return (
                        <TableRow key={i.id} className="cursor-default">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(i.occurred_at)}
                          </TableCell>
                          <TableCell className="text-sm">{i.sender_raw ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{i.content?.slice(0, 150) ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs border-0 ${tCfg.className}`}>{tCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-base">{CHANNEL_ICONS[i.channel] ?? "📡"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Interações ── */}
        <TabsContent value="interactions" className="min-h-[500px]">
          <InteractionsFeed clientId={client.id} />
        </TabsContent>

        {/* ── TAB 2: Participantes ── */}
        <TabsContent value="participants" className="space-y-6">
          <ParticipantSection title="Time do cliente" participants={clientTeam} badgeColor="bg-orange-100 text-orange-700" />
          <ParticipantSection title="Time uMode" participants={umodeTeam} badgeColor="bg-blue-100 text-blue-700" />
          <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
            + Adicionar participante
          </Button>
        </TabsContent>

        {/* ── TAB 3: Canais ── */}
        <TabsContent value="channels" className="space-y-6">
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Canais conectados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bindings.length === 0 && <p className="text-sm text-muted-foreground">Nenhum canal conectado.</p>}
              {bindings.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
                      {CHANNEL_ICONS[b.channel] ?? "📡"}
                    </div>
                    <div>
                      <span className="text-sm font-medium">{CHANNEL_LABELS[b.channel] ?? b.channel}</span>
                      <p className="text-xs text-muted-foreground">{b.channel_identifier}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-700 border-0 text-xs">Ativo</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info("Em breve")}>Reimportar Histórico</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Em breve")}>Desconectar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {disconnectedChannels.length > 0 && (
            <Card className="border border-border rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-muted-foreground">Canais disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {disconnectedChannels.map((ch) => (
                  <div key={ch} className="flex items-center justify-between rounded-lg border border-border p-3 opacity-50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-lg">
                        {CHANNEL_ICONS[ch] ?? "📡"}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{CHANNEL_LABELS[ch] ?? ch}</span>
                        <p className="text-xs text-muted-foreground">Não conectado</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">Em breve</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
            + Conectar canal
          </Button>
        </TabsContent>

        {/* ── TAB 4: Documentos ── */}
        <TabsContent value="documents" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Documentos</h3>
            <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum documento adicionado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{DOC_ICONS[doc.type.toLowerCase()] ?? "🗺"}</span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type.toUpperCase()} · {doc.size_kb}KB · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    {doc.category.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {doc.category.map((cat) => (
                          <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => toast.info("Em breve")}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Arraste arquivos aqui ou clique para fazer upload</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, PNG — máximo 20MB</p>
          </div>
        </TabsContent>

        {/* ── TAB 5: Regras de Negócio ── */}
        <TabsContent value="rules" className="space-y-6">
          {/* Escopo */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Escopo contratado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                placeholder="Nenhum escopo definido."
                value={scopeText ?? ""}
                onChange={(e) => setScopeText(e.target.value)}
              />
              <Button size="sm" onClick={handleSaveScope} disabled={savingScope}>
                {savingScope && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar Escopo
              </Button>
            </CardContent>
          </Card>

          {/* Temas */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Temas monitorados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {monitoredThemes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum tema definido.</p>}
                {monitoredThemes.map((theme) => (
                  <Badge key={theme} className="bg-primary/10 text-primary border-0">{theme}</Badge>
                ))}
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => toast.info("Em breve")}
                >
                  + adicionar
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Governance rules */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Regras de governança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {governanceRules.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra definida.</p>}
              {governanceRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{rule.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    </div>
                  </div>
                  <Badge variant={rule.active ? "default" : "secondary"} className="text-xs">
                    {rule.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
                + Nova regra
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 6: Configurações ── */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SLA */}
            <Card className="border border-border rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">SLA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Horário início</Label>
                    <Input value={sla?.hours_start ?? "08:00"} readOnly className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Horário fim</Label>
                    <Input value={sla?.hours_end ?? "19:00"} readOnly className="h-9 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tempo de resposta esperado</Label>
                  <Input value={sla?.response_time_minutes ? `${sla.response_time_minutes} min` : "—"} readOnly className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Dias úteis</Label>
                  <Input value={sla?.working_days ?? "Seg – Sex"} readOnly className="h-9 text-sm" />
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Em breve")}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar SLA
                </Button>
              </CardContent>
            </Card>

            {/* Alertas */}
            <Card className="border border-border rounded-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Alertas específicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {auditRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma regra de alerta configurada.</p>
                ) : (
                  auditRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between">
                      <span className="text-sm">{rule.name}</span>
                      <Switch
                        checked={rule.active ?? false}
                        onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Danger zone */}
          <Card className="border border-destructive/30 rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-destructive">Zona de perigo</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                    Desativar {client.name}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O cliente será desativado. Dados e interações são preservados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeactivate}
                      disabled={deactivating}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deactivating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Confirmar desativação
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Sub-components ──

function KPICard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="border border-border rounded-xl">
      <CardContent className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ParticipantSection({ title, participants, badgeColor }: {
  title: string;
  participants: Participant[];
  badgeColor: string;
}) {
  return (
    <Card className="border border-border rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum participante.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => {
                const ids = Array.isArray(p.identifiers) ? p.identifiers : [];
                const email = ids.find((id) => id.channel === "email")?.value ?? "—";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs border-0 ${badgeColor}`}>
                        {p.role ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {ids.map((id, idx) => (
                          <span key={idx} className="text-sm">{CHANNEL_ICONS[id.channel] ?? "📡"}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast.info("Em breve")}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info("Em breve")}>Remover</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ClientDetailPage;
