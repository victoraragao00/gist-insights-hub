import {
  Plus, ArrowRightLeft, User, Lock, Unlock, Edit, Link2, MessageSquare, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDemandActivities } from "@/hooks/useDemands";
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
  const { data: activities = [] } = useDemandActivities(demandId);

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>;
  }

  return (
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
  );
}
