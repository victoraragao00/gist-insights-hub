import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

interface Props {
  data: TechDashboardData["hours"];
}

export function HoursCard({ data }: Props) {
  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Horas — investidas vs estimadas
        </p>
        <div className="text-xs text-muted-foreground py-6 text-center">
          Sem horas registradas no período.
        </div>
      </div>
    );
  }

  const estimated = data.total_estimated ?? 0;
  const actual = data.total_actual ?? 0;
  const pct = estimated > 0 ? Math.round((actual / estimated) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Horas — investidas vs estimadas
      </p>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">Estimadas</span>
        <span className="font-medium">{estimated.toFixed(1)}h</span>
      </div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-muted-foreground">Registradas</span>
        <span
          className={cn(
            "font-medium",
            pct > 100
              ? "text-destructive"
              : pct < 60
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {actual.toFixed(1)}h ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: pct > 100 ? "#E24B4A" : "#7F77DD",
          }}
        />
      </div>
      <div className="space-y-0 divide-y divide-border/50">
        {(data.by_area ?? []).map((area) => {
          const areaPct =
            area.estimated > 0 ? Math.round((area.actual / area.estimated) * 100) : null;
          return (
            <div
              key={area.area_id}
              className="flex items-center justify-between py-1.5 text-xs"
            >
              <span className="text-muted-foreground truncate flex-1">
                {area.area_name}
              </span>
              <span
                className={cn(
                  "font-medium ml-2",
                  areaPct !== null && areaPct > 100
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {area.actual.toFixed(1)}h / {area.estimated.toFixed(1)}h
                {areaPct !== null && (
                  <span className="ml-1 text-muted-foreground/60">({areaPct}%)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
