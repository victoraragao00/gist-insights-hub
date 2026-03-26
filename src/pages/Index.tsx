import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { usePriorityScores, type PriorityScoreRow, type PriorityPattern } from "@/hooks/usePriorityScores";
import { useRecalculatePriority } from "@/hooks/useRecalculatePriority";
import { useGlobalStats } from "@/hooks/useGlobalStats";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 50;
const TIER_CLASS: Record<string, string> = {
  azzas: "bg-primary text-primary-foreground",
  enterprise: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  medium: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  small: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};
const SEVERITY_CLASS: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};
function scoreColorClass(score: number): string {
  const s = Math.min(score, 100);
  if (s >= 80) return "text-red-600 bg-red-500 dark:text-red-400 dark:bg-red-600";
  if (s >= 60) return "text-orange-600 bg-orange-500 dark:text-orange-400 dark:bg-orange-600";
  if (s >= 30) return "text-yellow-600 bg-yellow-500 dark:text-yellow-400 dark:bg-yellow-600";
  return "text-emerald-600 bg-emerald-500 dark:text-emerald-400 dark:bg-emerald-600";
}
function scoreBarClass(score: number): string {
  const s = Math.min(score, 100);
  if (s >= 80) return "bg-red-500 dark:bg-red-600";
  if (s >= 60) return "bg-orange-500 dark:bg-orange-600";
  if (s >= 30) return "bg-yellow-500 dark:bg-yellow-600";
  return "bg-emerald-500 dark:bg-emerald-600";
}

function PatternItem({ p }: { p: PriorityPattern }) {
  const sev = (p.severity ?? "medium") as keyof typeof SEVERITY_CLASS;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      {p.theme && <span className="font-medium text-foreground">{p.theme}</span>}
      <Badge className={SEVERITY_CLASS[sev] ?? SEVERITY_CLASS.medium} variant="outline">
        {sev}
      </Badge>
      {p.user_count != null && (
        <span className="text-muted-foreground">{p.user_count} usuários</span>
      )}
      {p.description && (
        <span className="w-full text-muted-foreground md:w-auto">{p.description}</span>
      )}
    </div>
  );
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: scores, isLoading: scoresLoading, isError, refetch } = usePriorityScores();
  const { data: globalStats, isLoading: globalStatsLoading } = useGlobalStats();
  const recalc = useRecalculatePriority();

  const { data: clientsWithoutConfigCount = 0 } = useQuery({
    queryKey: ["clients-without-priority-config", user?.id],
    queryFn: async () => {
      const { data: clients, error: e1 } = await supabase.from("clients").select("id");
      if (e1) throw e1;
      const { data: configs, error: e2 } = await supabase
        .from("client_priority_config")
        .select("client_id");
      if (e2) throw e2;
      const configIds = new Set((configs ?? []).map((c) => c.client_id));
      return (clients ?? []).filter((c) => !configIds.has(c.id)).length;
    },
    enabled: !!user?.id && isAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const list = (scores ?? []) as PriorityScoreRow[];
  const scoreBuckets = useMemo(() => {
    const buckets = { ok: 0, atencao: 0, alerta: 0, critico: 0 };
    list.forEach((r) => {
      const s = Math.min(r.score, 100);
      if (s >= 80) buckets.critico++;
      else if (s >= 60) buckets.alerta++;
      else if (s >= 40) buckets.atencao++;
      else buckets.ok++;
    });
    return [
      { name: "0-39", value: buckets.ok, fill: SCORE_BUCKET_COLORS.ok },
      { name: "40-59", value: buckets.atencao, fill: SCORE_BUCKET_COLORS.atencao },
      { name: "60-79", value: buckets.alerta, fill: SCORE_BUCKET_COLORS.alerta },
      { name: "80+", value: buckets.critico, fill: SCORE_BUCKET_COLORS.critico },
    ];
  }, [list]);
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { azzas: 0, enterprise: 0, medium: 0, small: 0 };
    list.forEach((r) => {
      counts[r.tier] = (counts[r.tier] ?? 0) + 1;
    });
    return [
      { name: "azzas", value: counts.azzas, fill: "hsl(var(--primary))" },
      { name: "enterprise", value: counts.enterprise, fill: "hsl(221, 83%, 53%)" },
      { name: "medium", value: counts.medium, fill: "hsl(215, 14%, 34%)" },
      { name: "small", value: counts.small, fill: "hsl(220, 9%, 46%)" },
    ].filter((d) => d.value > 0);
  }, [list]);
  const filteredList = useMemo(() => {
    let result = list;
    if (debouncedSearch.length >= 3) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((r) => r.client_name.toLowerCase().includes(q));
    }
    if (tierFilter !== "all") {
      result = result.filter((r) => r.tier === tierFilter);
    }
    return result.slice(0, PAGE_SIZE);
  }, [list, debouncedSearch, tierFilter]);

  if (roleLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Prioridade</h1>
          <p className="text-muted-foreground">
            Clientes ordenados por score de prioridade (últimos 30 dias).
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {clientsWithoutConfigCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {clientsWithoutConfigCount} cliente(s) sem configuração de prioridade
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => recalc.mutate(undefined)}
              disabled={recalc.isPending}
            >
              {recalc.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar agora
            </Button>
          </div>
        )}
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar scores</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados. Tente novamente.
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isError && scoresLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl animate-shimmer" />
          ))}
        </div>
      )}

      {!isError && !scoresLoading && list.length === 0 && (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-foreground">Nenhum score calculado ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Os scores são atualizados após a classificação. Configure prioridades nos clientes.
            </p>
          </CardContent>
        </Card>
      )}

      {!isError && !scoresLoading && list.length > 0 && (
        <>
          {/* Global KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {globalStatsLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="border-border">
                    <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                    <CardContent><Skeleton className="h-8 w-16 animate-shimmer" /><Skeleton className="h-3 w-20 mt-1" /></CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <KPICard title="Interações 30d" value={String(globalStats?.total_interactions_30d ?? 0)} subtitle="classificadas" icon={Activity} />
                <KPICard title="% Crítico" value={`${(globalStats?.pct_critico ?? 0).toFixed(1)}%`} subtitle="últimos 30 dias" icon={AlertCircle} />
                <KPICard title="% Alerta" value={`${(globalStats?.pct_alerta ?? 0).toFixed(1)}%`} subtitle="últimos 30 dias" icon={AlertTriangle} />
                <KPICard title="Clientes monitorados" value={String(globalStats?.total_clients_monitored ?? 0)} subtitle="com interações" icon={Users} />
              </>
            )}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolução de tom */}
            {globalStats?.monthly_tone_evolution?.length ? (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Evolução de tom (últimos 6 meses)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{ ok: { label: "Ok", color: "hsl(160, 84%, 39%)" }, atencao: { label: "Atenção", color: "hsl(48, 96%, 53%)" }, alerta: { label: "Alerta", color: "hsl(25, 95%, 53%)" }, critico: { label: "Crítico", color: "hsl(0, 84%, 60%)" } }} className="h-64 w-full">
                    <BarChart data={globalStats.monthly_tone_evolution} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="ok" stackId="tone" fill="var(--color-ok)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="atencao" stackId="tone" fill="var(--color-atencao)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="alerta" stackId="tone" fill="var(--color-alerta)" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="critico" stackId="tone" fill="var(--color-critico)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : null}
            {/* Top 5 temas */}
            {globalStats?.top_themes?.length ? (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Temas mais frequentes (30d)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{ count: { label: "Ocorrências", color: "hsl(var(--primary))" } }} className="h-48 w-full">
                    <BarChart layout="vertical" data={globalStats.top_themes.slice(0, 5)} margin={{ left: 60, right: 8, top: 8, bottom: 8 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="theme" width={55} tick={{ fontSize: 10 }} tickFormatter={(v) => (v.length > 12 ? v.slice(0, 12) + "…" : v)} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : null}
            {/* Distribuição de score */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Distribuição de score</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ value: { label: "Clientes" } }} className="h-64 w-full">
                  <BarChart data={scoreBuckets} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {scoreBuckets.map((_, i) => (
                        <Cell key={i} fill={scoreBuckets[i].fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            {/* Clientes por tier */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Clientes por tier</CardTitle>
              </CardHeader>
              <CardContent>
                {tierCounts.length > 0 ? (
                  <ChartContainer config={{}} className="h-64 w-full">
                    <PieChart>
                      <Pie data={tierCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2}>
                        {tierCounts.map((_, i) => (
                          <Cell key={i} fill={tierCounts[i].fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhum dado</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Todos os tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="azzas">azzas</SelectItem>
                <SelectItem value="enterprise">enterprise</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="small">small</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredList.length} de {list.length} clientes
          </p>
          <div className="space-y-3">
          {filteredList.map((row, i) => {
            const displayScore = Math.min(row.score, 100);
            const scorePct = Math.min((row.score / 100) * 100, 100);
            const isCritical = displayScore >= 80;
            return (
              <Collapsible key={row.id}>
                <Card
                  className={`border-border transition-shadow duration-200 hover:shadow-md ${isCritical ? "animate-pulse-subtle" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div
                      className="flex flex-wrap items-center gap-3 animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg tabular-nums text-lg font-bold ${scoreColorClass(row.score)} animate-score-pop`}
                      >
                        {displayScore}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold">
                          <button
                            type="button"
                            className="text-left hover:underline focus:outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                            onClick={() => navigate(`/clients/${row.client_slug}`)}
                          >
                            {row.client_name}
                          </button>
                        </CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge className={TIER_CLASS[row.tier] ?? TIER_CLASS.medium}>
                            {row.tier}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Atualizado {formatDistanceToNow(new Date(row.calculated_at), { locale: ptBR, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 group focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Expandir ou recolher padrões">
                          <ChevronDown className="h-4 w-4 group-data-[state=open]:hidden" />
                          <ChevronUp className="h-4 w-4 hidden group-data-[state=open]:block" />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${scoreBarClass(row.score)} animate-progress-fill`}
                        style={{ ["--progress-width" as string]: `${scorePct}%` }}
                      />
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {row.patterns.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum padrão detectado.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Padrões</p>
                          {row.patterns.map((p, idx) => (
                            <PatternItem key={`${p.theme ?? "p"}-${p.severity ?? "s"}-${idx}`} p={p} />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
          </div>
        </>
      )}

      {!isError && !scoresLoading && list.length > PAGE_SIZE && debouncedSearch.length === 0 && tierFilter === "all" && (
        <p className="text-center text-sm text-muted-foreground">
          Exibindo os {PAGE_SIZE} primeiros de {list.length} clientes.
        </p>
      )}
    </div>
  );
};

export default Index;
