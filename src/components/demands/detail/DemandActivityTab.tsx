import { useMemo } from "react";
import {
  Plus, ArrowRightLeft, User, Lock, Unlock, Edit, Link2, MessageSquare, X, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDemandActivities } from "@/hooks/useDemands";
import { useDemandTimeEntriesAll } from "@/hooks/useDemandTasks";
import { useDeleteTimeEntry } from "@/hooks/useDemandTimeEntries";
import { useAuth } from "@/context/AuthContext";
import { formatHours } from "@/lib/formatHours";
import { TimeEntryRow, getInitials } from "./TimeEntryRow";
import type { Tables } from "@/integrations/supabase/types";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  moved: ArrowRightLeft,
  assigned: User,
  blocked: Lock,
  unblocked: Unlock,
  edited: Edit,
  linked_interaction: Link2,
  commented: MessageSquare,
  cancelled: X,
};

interface DemandActivityTabProps {
  demandId: string;
}

export function DemandActivityTab({ demandId }: DemandActivityTabProps) {
  const { user } = useAuth();
  const { data: activities = [] } = useDemandActivities(demandId);
  const { data: allEntries = [] } = useDemandTimeEntriesAll(demandId);
  const deleteEntry = useDeleteTimeEntry();

  const { hoursByPerson, maxPersonHours, totalHours } = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    let total = 0;
    for (const e of allEntries) {
      const hours =
        e.hours_manual != null
          ? Number(e.hours_manual)
          : e.started_at && e.ended_at
            ? Math.max(0, (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 3_600_000)
            : 0;
      total += hours;
      const userId = e.user_id;
      const name = e.user_profiles?.full_name ?? e.user_profiles?.email ?? "Usuário";
      if (!map[userId]) map[userId] = { name, total: 0 };
      map[userId].total += hours;
    }
    const max = Math.max(0, ...Object.values(map).map((p) => p.total));
    return { hoursByPerson: map, maxPersonHours: max, totalHours: total };
  }, [allEntries]);

  return (
    <div className="space-y-6">
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
      ) : (
        <div className="space-y-3">
          {activities.map((act: Tables<"demand_activities">) => {
            const Icon = EVENT_ICONS[act.event_type] ?? Edit;
            return (
              <div key={act.id} className="flex gap-3 items-start text-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-foreground">{act.description}</p>
                  {act.created_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allEntries.length > 0 && (
        <div className="pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Horas registradas
            </h3>
            <span className="text-sm font-semibold">{formatHours(totalHours)}</span>
          </div>

          <div className="space-y-2 mb-4">
            {Object.entries(hoursByPerson).map(([userId, data]) => (
              <div key={userId} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {getInitials(data.name)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{data.name}</span>
                    <span className="font-semibold">{formatHours(data.total)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{
                        width: `${maxPersonHours > 0 ? (data.total / maxPersonHours) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Collapsible>
            <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 group">
              <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
              Ver todas as {allEntries.length} entradas
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {allEntries.map((entry) => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    showTask
                    currentUserId={user?.id}
                    onDelete={(entryId) => deleteEntry.mutate({ entryId })}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
