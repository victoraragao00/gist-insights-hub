import { cn } from "@/lib/utils";
import type { TechDashboardData } from "@/hooks/useTechDashboard";

interface Props {
  data: TechDashboardData["people"];
  isAdmin: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PeopleCard({ data, isAdmin }: Props) {
  const people = data ?? [];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
        {isAdmin ? "Carga por pessoa" : "Minhas métricas"}
      </p>
      {people.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">
          Sem dados no período.
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {people.map((person) => {
            const wipColor =
              person.wip_count > 3
                ? "#E24B4A"
                : person.wip_count > 2
                  ? "#EF9F27"
                  : "#1D9E75";
            const display = person.name || person.email || "—";
            return (
              <div key={person.user_id}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-[10px] font-medium flex items-center justify-center flex-shrink-0">
                    {getInitials(display)}
                  </div>
                  <span className="text-sm font-medium flex-1 truncate">
                    {display}
                  </span>
                  <span
                    className={cn("text-xs font-medium")}
                    style={{ color: wipColor }}
                  >
                    {person.wip_count} em andamento
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((person.wip_count / 6) * 100, 100)}%`,
                        background: wipColor,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {(person.hours_period ?? 0).toFixed(1)}h ·{" "}
                    {person.delivered_period ?? 0} entregas
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
