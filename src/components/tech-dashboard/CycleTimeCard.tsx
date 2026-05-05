import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

interface Props {
  data: TechDashboardData["cycle_time"];
}

export function CycleTimeCard({ data }: Props) {
  const dist = data?.distribution ?? [];
  const reopen = data?.reopen_count ?? 0;

  const rows = [
    {
      key: "Mediana (P50)",
      val: data?.p50_cycle != null ? `${data.p50_cycle.toFixed(1)} dias` : "—",
      color: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "P85",
      val: data?.p85_cycle != null ? `${data.p85_cycle.toFixed(1)} dias` : "—",
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      key: "Lead time médio",
      val: data?.avg_lead != null ? `${data.avg_lead.toFixed(1)} dias` : "—",
      color: "text-muted-foreground",
    },
    {
      key: "Retrabalho",
      val: `${reopen} reabertas`,
      color: reopen > 0 ? "text-destructive" : "text-muted-foreground",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Cycle time — distribuição
      </p>
      <div style={{ width: "100%", height: 120 }}>
        {dist.length > 0 ? (
          <ResponsiveContainer>
            <BarChart data={dist} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#7F77DD" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Sem dados de distribuição
          </div>
        )}
      </div>
      <div className="space-y-0 divide-y divide-border/50 mt-3">
        {rows.map((r) => (
          <div key={r.key} className="flex justify-between py-1.5 text-xs">
            <span className="text-muted-foreground">{r.key}</span>
            <span className={cn("font-medium", r.color)}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
