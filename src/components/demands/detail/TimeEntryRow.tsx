import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/formatHours";
import type { TimeEntryWithUser } from "@/hooks/useDemandTasks";

function getInitials(label?: string | null) {
  if (!label) return "?";
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function entryDuration(entry: TimeEntryWithUser): number | null {
  if (entry.hours_manual != null) return Number(entry.hours_manual);
  if (entry.started_at && entry.ended_at) {
    return (
      (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) /
      3_600_000
    );
  }
  return null;
}

interface TimeEntryRowProps {
  entry: TimeEntryWithUser;
  showTask?: boolean;
  currentUserId?: string;
  onDelete?: (entryId: string) => void;
}

export function TimeEntryRow({ entry, showTask, currentUserId, onDelete }: TimeEntryRowProps) {
  const duration = entryDuration(entry);
  const user = entry.user_profiles;
  const isManual = entry.hours_manual != null;
  const canDelete = !!onDelete && entry.user_id === currentUserId;
  const label = user?.full_name ?? user?.email ?? "Usuário";

  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-border bg-card transition-colors">
      <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {getInitials(label)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{label}</span>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded border font-medium",
              isManual
                ? "bg-muted/60 text-muted-foreground border-border/60"
                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
            )}
          >
            {isManual ? "Manual" : "Timer"}
          </span>
          {duration !== null && (
            <span className="text-sm font-semibold text-foreground">
              {formatHours(duration)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          {!isManual && entry.started_at ? (
            <span>
              {format(new Date(entry.started_at), "dd MMM HH:mm", { locale: ptBR })}
              {entry.ended_at && ` → ${format(new Date(entry.ended_at), "HH:mm")}`}
            </span>
          ) : (
            <span>
              {format(new Date(entry.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
            </span>
          )}
          {entry.description && (
            <span className="text-muted-foreground/70 truncate">· {entry.description}</span>
          )}
          {showTask && entry.demand_tasks?.title && (
            <span className="text-muted-foreground/60">· task: {entry.demand_tasks.title}</span>
          )}
        </div>
      </div>

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete!(entry.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label="Excluir entrada"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export { getInitials };
