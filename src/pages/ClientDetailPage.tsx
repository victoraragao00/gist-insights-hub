import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link, useNavigate as useNav } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { ChevronRight, MoreHorizontal, Loader2, AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InteractionsFeed } from "@/components/InteractionsFeed";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePriorityScores } from "@/hooks/usePriorityScores";
import { useClientToneTrend } from "@/hooks/useClientToneTrend";
import { useClientDemands } from "@/hooks/useClientDemands";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { CreateDemandDialog } from "@/components/demands/CreateDemandDialog";
import { DemandDetailSheet } from "@/components/demands/DemandDetailSheet";
import type { DemandRow } from "@/hooks/useDemands";

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
  status: string;
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
  ok: { label: "✓ Ok", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  atencao: { label: "⚠ Atenção", className: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400" },
  alerta: { label: "🔶 Alerta", className: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" },
  critico: { label: "🔴 Crítico", className: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  trial: { label: "Trial", className: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
  inativo: { label: "Inativo", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
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

const PAGE_SIZE = 50;

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (isSameLocalDay(d, now)) return `Hoje, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(d, yesterday)) return `Ontem, ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${time}`;
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (diffMinutes < 1) return "agora mesmo";
  if (diffMinutes < 60) return `há ${diffMinutes} minuto${diffMinutes > 1 ? "s" : ""}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  if (isSameLocalDay(d, now)) return `hoje às ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(d, yesterday)) return `ontem às ${time}`;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
}

// ── Component ──

const TIER_OPTIONS = ["azzas", "enterprise", "medium", "small"] as const;
const STATUS_OPTIONS = ["ativo", "trial", "inativo"] as const;

const ClientDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();

  const [scopeText, setScopeText] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState<string>("ativo");
  const [editTier, setEditTier] = useState<string>("medium");
  const [pageInteractions, setPageInteractions] = useState(0);
  const [pageParticipants, setPageParticipants] = useState(0);
  const [createDemandOpen, setCreateDemandOpen] = useState(false);
  const [selectedDemand, setSelectedDemand] = useState<DemandRow | null>(null);
  const [demandSheetOpen, setDemandSheetOpen] = useState(false);

  const thirtyDaysAgo = useMemo(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), []
  );

  // ── Queries ──

  const { data: client, isLoading: loadingClient, isError: clientError, refetch: refetchClient } = useQuery<ClientDetail | null>({
    queryKey: ["client_detail", user?.id, slug],
    enabled: !!slug && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, slug, active, status, metadata, created_at")
        .eq("slug", slug!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ClientDetail | null;
    },
  });

  const clientId = client?.id;
  const meta = (client?.metadata ?? {}) as ClientMetadata;

  const { data: participantsData } = useQuery<{ list: Participant[]; totalCount: number }>({
    queryKey: ["detail_participants", user?.id, clientId, pageParticipants],
    enabled: !!clientId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const from = pageParticipants * PAGE_SIZE;
      const to = (pageParticipants + 1) * PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("participants")
        .select("id, name, role, side, identifiers, active", { count: "exact" })
        .eq("client_id", clientId!)
        .order("name")
        .range(from, to);
      if (error) throw error;
      return { list: (data ?? []) as Participant[], totalCount: count ?? 0 };
    },
  });

  const participants = participantsData?.list ?? [];
  const participantsTotalCount = participantsData?.totalCount ?? 0;

  const { data: bindings = [] } = useQuery<ChannelBinding[]>({
    queryKey: ["detail_bindings", user?.id, clientId],
    enabled: !!clientId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_bindings")
        .select("id, channel, channel_identifier, label, active")
        .eq("client_id", clientId!)
        .range(0, PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as ChannelBinding[];
    },
  });

  const { data: interactionsData } = useQuery<{ list: Interaction[]; totalCount: number }>({
    queryKey: ["detail_interactions_30d", user?.id, clientId, thirtyDaysAgo, pageInteractions],
    enabled: !!clientId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const from = pageInteractions * PAGE_SIZE;
      const to = (pageInteractions + 1) * PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("interactions")
        .select("id, tone, occurred_at, sender_raw, sender_side, content, channel, is_out_of_scope", { count: "exact" })
        .eq("client_id", clientId!)
        .gte("occurred_at", thirtyDaysAgo)
        .order("occurred_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { list: (data ?? []) as Interaction[], totalCount: count ?? 0 };
    },
  });

  const interactions = interactionsData?.list ?? [];
  const interactionsTotalCount = interactionsData?.totalCount ?? 0;

  const { data: auditRules = [] } = useQuery<AuditRule[]>({
    queryKey: ["detail_audit_rules", user?.id, clientId],
    enabled: !!clientId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_rules")
        .select("id, metric, name, active")
        .eq("client_id", clientId!)
        .range(0, PAGE_SIZE - 1);
      if (error) throw error;
      return (data ?? []) as AuditRule[];
    },
  });

  const { data: totalInteractionsCount = 0 } = useQuery<number>({
    queryKey: ["detail_total_interactions", user?.id, clientId],
    enabled: !!clientId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: scores } = usePriorityScores();
  const clientScore = useMemo(() => {
    if (!client || !scores) return null;
    return scores.find((s) => s.client_id === client.id) ?? null;
  }, [client, scores]);

  const { data: toneTrend, isLoading: toneTrendLoading } = useClientToneTrend(clientId ?? undefined);
  const { data: clientDemands = [], isLoading: loadingDemands } = useClientDemands(clientId);
  const toneTrendChartData = useMemo(
    () =>
      toneTrend?.map((d) => ({
        ...d,
        day: new Date(d.day + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      })) ?? [],
    [toneTrend]
  );
  const toneTrendEmpty = toneTrend && toneTrend.every((d) => d.ok === 0 && d.atencao === 0 && d.alerta === 0 && d.critico === 0);

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

  // Initialize edit state when client and clientScore load
  useEffect(() => {
    if (!client) return;
    setEditName(client.name);
    setEditStatus(client.status ?? "ativo");
    setScopeText((client.metadata as ClientMetadata | null)?.scope ?? "");
  }, [client]);

  useEffect(() => {
    if (clientScore) setEditTier(clientScore.tier);
  }, [clientScore]);

  // ── Actions ──

  const saveClientMutation = useMutation({
    mutationFn: async (payload: {
      client: ClientDetail;
      name: string;
      status: string;
      scopeText: string | null;
      tier: string;
    }) => {
      const existing = (payload.client.metadata ?? {}) as Record<string, unknown>;
      const { error: errClient } = await supabase
        .from("clients")
        .update({
          name: payload.name,
          status: payload.status,
          metadata: { ...existing, scope: payload.scopeText },
        })
        .eq("id", payload.client.id);
      if (errClient) throw errClient;

      const { error: errConfig } = await supabase
        .from("client_priority_config")
        .upsert(
          {
            client_id: payload.client.id,
            tier: payload.tier as "azzas" | "enterprise" | "medium" | "small",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id" }
        );
      if (errConfig) throw errConfig;
    },
    onSuccess: () => {
      toast.success("Dados do cliente salvos!");
      queryClient.invalidateQueries({ queryKey: ["client_detail", user?.id, slug] });
      queryClient.invalidateQueries({ queryKey: ["clients_list", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["client_priority_config"] });
      queryClient.invalidateQueries({ queryKey: ["priority-scores", user?.id] });
    },
    onError: (err) => {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : "Erro"));
    },
  });

  const handleSaveClient = () => {
    if (!client) return;
    saveClientMutation.mutate({
      client,
      name: editName,
      status: editStatus,
      scopeText,
      tier: editTier,
    });
  };

  const deactivateMutation = useMutation({
    mutationFn: async (clientToDeactivate: ClientDetail) => {
      const { error } = await supabase
        .from("clients")
        .update({ active: false })
        .eq("id", clientToDeactivate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente desativado");
      navigate("/clients");
    },
    onError: (err) => {
      toast.error("Erro: " + (err instanceof Error ? err.message : "Erro"));
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, active }: { ruleId: string; active: boolean }) => {
      const { error } = await supabase
        .from("audit_rules")
        .update({ active })
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detail_audit_rules", user?.id, clientId] });
    },
    onError: () => toast.error("Erro ao atualizar regra"),
  });

  // ── Loading / Not found ──

  if (loadingClient) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64 animate-shimmer" />
        <Skeleton className="h-4 w-40 animate-shimmer" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-xl animate-shimmer" />)}
        </div>
      </div>
    );
  }

  if (clientError) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar cliente</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados. Tente novamente.
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchClient()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => navigate("/clients")}>
          Voltar para Clientes
        </Button>
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
            <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[client.status]?.className ?? ""}`}>
              {STATUS_CONFIG[client.status]?.label ?? client.status}
            </span>
            <Badge variant="outline" className={`text-xs border-0 ${dominantTone.className}`}>
              {dominantTone.label}
            </Badge>
          </div>
          {client.status === "inativo" && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Este cliente está inativo. Interações continuam sendo processadas normalmente.
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            slug: {client.slug} · {bindings.length} canais · Última msg {stats.last_contact ? formatDate(stats.last_contact) : "—"}{" "}
            <span className="inline-flex items-center gap-1 ml-2 text-muted-foreground/70">
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
              Último acesso Gist: {meta.last_seen_at ? formatRelativeTime(meta.last_seen_at) : "—"}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="interactions">Interações</TabsTrigger>
          <TabsTrigger value="participants">Participantes ({participantsTotalCount})</TabsTrigger>
          <TabsTrigger value="channels">Canais ({bindings.length})</TabsTrigger>
          <TabsTrigger value="documents">Documentos ({documents.length})</TabsTrigger>
          <TabsTrigger value="rules">Regras de Negócio</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
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
            <div className={clientScore && clientScore.score >= 80 ? "animate-pulse-subtle" : ""}>
              <KPICard
                label="Score de Prioridade"
                value={clientScore ? String(Math.min(clientScore.score, 100)) : "—"}
                sub={clientScore ? `Tier: ${clientScore.tier}` : "sem config"}
              />
            </div>
          </div>

          {/* Volume Chart */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Volume de interações (últimos 14 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[120px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeData.entries.map(([day, count]) => ({ day: day.slice(5), count }))}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      labelFormatter={(v) => `Dia ${v}`}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tone trend 7d */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Evolução de tom (7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {toneTrendLoading ? (
                <Skeleton className="h-48 w-full animate-shimmer" />
              ) : toneTrendEmpty ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem interações classificadas nos últimos 7 dias</p>
              ) : toneTrendChartData.length > 0 ? (
                <ChartContainer
                  config={{
                    ok: { label: "Ok", color: "hsl(160, 84%, 39%)" },
                    atencao: { label: "Atenção", color: "hsl(48, 96%, 53%)" },
                    alerta: { label: "Alerta", color: "hsl(25, 95%, 53%)" },
                    critico: { label: "Crítico", color: "hsl(0, 84%, 60%)" },
                  }}
                  className="h-48 w-full"
                >
                  <BarChart data={toneTrendChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="ok" stackId="tone" fill="var(--color-ok)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="atencao" stackId="tone" fill="var(--color-atencao)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="alerta" stackId="tone" fill="var(--color-alerta)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="critico" stackId="tone" fill="var(--color-critico)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : null}
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
          {interactionsTotalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Página {pageInteractions + 1} de {Math.ceil(interactionsTotalCount / PAGE_SIZE) || 1}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPageInteractions((p) => p - 1)}
                  disabled={pageInteractions === 0}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPageInteractions((p) => p + 1)}
                  disabled={(pageInteractions + 1) * PAGE_SIZE >= interactionsTotalCount}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB: Interações ── */}
        <TabsContent value="interactions" className="min-h-[500px]">
          <InteractionsFeed clientId={client.id} />
        </TabsContent>

        {/* ── TAB 2: Participantes ── */}
        <TabsContent value="participants" className="space-y-6">
          <ParticipantSection title="Time do cliente" participants={clientTeam} badgeColor="bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400" />
          <ParticipantSection title="Time uMode" participants={umodeTeam} badgeColor="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" />
          {participantsTotalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Página {pageParticipants + 1} de {Math.ceil(participantsTotalCount / PAGE_SIZE) || 1}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPageParticipants((p) => p - 1)}
                  disabled={pageParticipants === 0}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPageParticipants((p) => p + 1)}
                  disabled={(pageParticipants + 1) * PAGE_SIZE >= participantsTotalCount}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
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
                    <Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border-0 text-xs">Ativo</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Menu do canal">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info("Em breve")}>Reimportar Histórico</DropdownMenuItem>
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
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </TabsContent>

        {/* ── TAB 4: Documentos ── */}
        <TabsContent value="documents" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">Documentos</h3>
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

        </TabsContent>

        {/* ── TAB 5: Regras de Negócio ── */}
        <TabsContent value="rules" className="space-y-6">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 6: Configurações ── */}
        <TabsContent value="settings" className="space-y-6">
          {/* Dados do cliente */}
          <Card className="border border-border rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Dados do cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdmin ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_CONFIG[s]?.label ?? s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Escopo contratado</Label>
                    <Textarea
                      rows={4}
                      placeholder="Nenhum escopo definido."
                      value={scopeText ?? ""}
                      onChange={(e) => setScopeText(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tier</Label>
                    <Select value={editTier} onValueChange={setEditTier}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIER_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveClient}
                    disabled={saveClientMutation.isPending}
                  >
                    {saveClientMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Salvar
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <p className="text-sm">{editName || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className={STATUS_CONFIG[editStatus]?.className ?? ""}>
                      {STATUS_CONFIG[editStatus]?.label ?? editStatus}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Escopo contratado</Label>
                    <p className="text-sm whitespace-pre-wrap">{scopeText || "Nenhum escopo definido."}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tier</Label>
                    <Badge variant="secondary">{editTier}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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
                        onCheckedChange={(checked) => toggleRuleMutation.mutate({ ruleId: rule.id, active: checked })}
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
                      onClick={() => client && deactivateMutation.mutate(client)}
                      disabled={deactivateMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deactivateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
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
