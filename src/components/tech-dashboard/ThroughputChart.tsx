import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

interface Props {
  data: TechDashboardData["throughput"];
}

export function ThroughputChart({ data }: Props) {
  const rows = data ?? [];
  const totalDone = rows.reduce((s, r) => s + (r.done ?? 0), 0);
  const totalCreated = rows.reduce((s, r) => s + (r.created ?? 0), 0);
  const rate =
    totalCreated > 0 ? Math.round((totalDone / totalCreated) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Throughput semanal
      </p>
      <div className="flex gap-4 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm inline-block"
            style={{ background: "#1D9E75" }}
          />
          Concluídas
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-sm inline-block"
            style={{ background: "#7F77DD80" }}
          />
          Criadas
        </span>
      </div>
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
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
            <Bar dataKey="done" name="Concluídas" fill="#1D9E75" radius={[4, 4, 0, 0]} />
            <Bar dataKey="created" name="Criadas" fill="#7F77DD80" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between pt-3 mt-3 border-t border-border text-xs">
        <span className="text-muted-foreground">Taxa entrega/entrada</span>
        <span
          className={cn(
            "font-medium",
            rate >= 80
              ? "text-emerald-600 dark:text-emerald-400"
              : rate >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-destructive",
          )}
        >
          {rate}%
        </span>
      </div>
    </div>
  );
}
