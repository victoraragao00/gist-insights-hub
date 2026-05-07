import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

interface Props {
  data: TechDashboardData["column_time"];
}

export function ColumnTimeCard({ data }: Props) {
  const rows = data ?? [];
  const maxDays = rows.length > 0 ? Math.max(...rows.map((c) => c.avg_days || 0)) : 1;
  const bottleneck = rows.find((c) => c.avg_days === maxDays && maxDays > 3);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        Tempo médio por coluna
      </p>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          Sem movimentação no período.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((col) => {
            const isBottleneck = bottleneck && col.column_id === bottleneck.column_id;
            return (
              <div
                key={col.column_id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                  isBottleneck && "bg-amber-50 dark:bg-amber-950/40",
                )}
              >
                <span
                  className={cn(
                    "flex-1 truncate",
                    isBottleneck && "font-medium text-amber-700 dark:text-amber-300",
                  )}
                >
                  {col.column_name}
                  {isBottleneck && " ⚠"}
                </span>
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${maxDays > 0 ? (col.avg_days / maxDays) * 100 : 0}%`,
                      background: isBottleneck ? "#EF9F27" : "#7F77DD",
                    }}
                  />
                </div>
                <div className="flex flex-col items-end shrink-0 w-16">
                  <span
                    className={cn(
                      "font-medium",
                      isBottleneck
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {col.avg_days?.toFixed?.(1) ?? col.avg_days}d
                  </span>
                  {col.p85_days != null && col.p85_days !== col.avg_days && (
                    <span className="text-[10px] text-muted-foreground/60">
                      P85: {col.p85_days?.toFixed?.(1) ?? col.p85_days}d
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {bottleneck && (
        <div className="mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-700 dark:text-amber-300">
          Gargalo em <strong>{bottleneck.column_name}</strong> — considere limitar o WIP
        </div>
      )}
    </div>
  );
}
