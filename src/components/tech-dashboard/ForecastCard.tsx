import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

interface Props {
  data: TechDashboardData["forecast"];
}

export function ForecastCard({ data }: Props) {
  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Forecast — backlog
        </p>
        <div className="text-xs text-muted-foreground py-6 text-center">
          Sem dados de forecast no período.
        </div>
      </div>
    );
  }

  const {
    backlog_count,
    weeks_optimist,
    weeks_probable,
    weeks_conservative,
    avg_throughput,
  } = data;

  const scenarios = [
    {
      label: "Otimista",
      weeks: weeks_optimist,
      bg: "bg-emerald-50 dark:bg-emerald-950",
      text: "text-emerald-700 dark:text-emerald-300",
      featured: false,
    },
    {
      label: "Provável",
      weeks: weeks_probable,
      bg: "bg-purple-50 dark:bg-purple-950",
      text: "text-purple-700 dark:text-purple-300",
      featured: true,
    },
    {
      label: "Conservador",
      weeks: weeks_conservative,
      bg: "bg-muted",
      text: "text-muted-foreground",
      featured: false,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
        Forecast — backlog
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        {backlog_count} demandas · {avg_throughput?.toFixed?.(1) ?? avg_throughput} entregas/sem (média)
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {scenarios.map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-lg p-3 text-center",
              s.bg,
              s.featured && "ring-1 ring-purple-300 dark:ring-purple-700",
            )}
          >
            <div className={cn("text-xl font-medium", s.text)}>
              {s.weeks != null ? `${s.weeks}sem` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground mb-1.5">
        Progresso em relação ao provável
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: "0%" }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>hoje</span>
        <span>P50 ({weeks_probable ?? "—"} sem)</span>
      </div>
    </div>
  );
}
