import { useState } from "react";
import { useClient } from "@/context/ClientContext";
import { useDemandAnalytics } from "@/hooks/useDemandAnalytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function DashKPICard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="border border-border rounded-xl shadow-sm">
      <CardContent className="p-4 space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "hsl(0, 84%, 60%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(48, 96%, 53%)",
  low: "hsl(160, 84%, 39%)",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa",
};

function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const DemandsDashboardPage = () => {
  const { clients } = useClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [days, setDays] = useState<number>(30);

  const clientId = selectedClientId === "all" ? null : selectedClientId;
  const { data, isLoading } = useDemandAnalytics(clientId, days);

  const totals = data?.totals;
  const byType = data?.by_type ?? [];
  const byPriority = (data?.by_priority ?? []).map((p) => ({
    ...p,
    label: PRIORITY_LABELS[p.priority] ?? p.priority,
    color: PRIORITY_COLORS[p.priority] ?? "hsl(var(--primary))",
  }));
  const byColumn = data?.by_column ?? [];
  const byArea = data?.by_area ?? [];
  const weeklyTrend = (data?.weekly_trend ?? []).map((w) => ({
    ...w,
    week: w.week ? w.week.toString().slice(5, 10) : "—",
  }));

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Dashboard de Demandas</h1>

        <div className="flex items-center gap-3">
          <Select
            value={selectedClientId}
            onValueChange={setSelectedClientId}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(days)}
            onValueChange={(v) => setDays(Number(v))}
          >
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl animate-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard label="Total" value={String(totals?.total ?? 0)} sub={`últimos ${days} dias`} />
          <KPICard label="Abertos" value={String(totals?.open ?? 0)} sub="em andamento" />
          <KPICard label="Concluídos" value={String(totals?.completed ?? 0)} sub="finalizados" />
          <KPICard label="Bloqueados" value={String(totals?.blocked ?? 0)} sub="com bloqueio" />
          <KPICard
            label="Lead Time médio"
            value={formatHours(totals?.avg_lead_time_hours)}
            sub="criação → conclusão"
          />
          <KPICard
            label="Cycle Time médio"
            value={formatHours(totals?.avg_cycle_time_hours)}
            sub="início → conclusão"
          />
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Tickets por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full animate-shimmer" />
            ) : byType.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byType} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar
                    dataKey="total"
                    radius={[4, 4, 0, 0]}
                    fill="hsl(var(--primary))"
                  >
                    {byType.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color ?? "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Priority */}
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-48 w-full animate-shimmer" />
            ) : byPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            ) : (
              <div className="flex flex-col items-center gap-4 w-full">
                <PieChart width={200} height={180}>
                  <Pie
                    data={byPriority}
                    dataKey="total"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {byPriority.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
                <div className="flex flex-wrap gap-3 justify-center">
                  {byPriority.map((p) => (
                    <div key={p.priority} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-muted-foreground">{p.label} ({p.total})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Column */}
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Tickets por Coluna</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full animate-shimmer" />
            ) : byColumn.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={byColumn}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Area */}
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Tickets por Área</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full animate-shimmer" />
            ) : byArea.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byArea} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {byArea.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color ?? "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card className="border border-border rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tendência Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full animate-shimmer" />
          ) : weeklyTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Sem dados suficientes</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyTrend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Tickets criados"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DemandsDashboardPage;
