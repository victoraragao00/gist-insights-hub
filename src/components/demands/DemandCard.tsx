import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Lock, Headphones, Bug, TrendingUp, Sparkles, Briefcase, Search, Clock } from "lucide-react";
import { formatHours } from "@/lib/formatHours";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DemandRow, DemandPriority } from "@/hooks/useDemands";
import { cn } from "@/lib/utils";

const PRIORITY_CLASSES: Record<DemandPriority, string> = {
  urgent: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  high: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  medium: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950",
  low: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
};

const PRIORITY_LABELS: Record<DemandPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  headphones: Headphones,
  bug: Bug,
  "trending-up": TrendingUp,
  sparkles: Sparkles,
  briefcase: Briefcase,
  search: Search,
};

interface DemandCardProps {
  demand: DemandRow;
  onClick: () => void;
}

export function DemandCard({ demand, onClick }: DemandCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: demand.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const TypeIcon = demand.demand_types?.icon
    ? ICON_MAP[demand.demand_types.icon] ?? null
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 cursor-pointer",
        "transition-shadow duration-200 hover:shadow-md",
        isDragging && "shadow-lg ring-2 ring-primary/20"
      )}
    >
      <p className="text-sm font-medium line-clamp-2 text-foreground">{demand.title}</p>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {/* Type badge */}
        {demand.demand_types && (
          <Badge
            variant="outline"
            className="text-xs gap-1"
            style={{
              borderColor: demand.demand_types.color ?? undefined,
              color: demand.demand_types.color ?? undefined,
            }}
          >
            {TypeIcon && <TypeIcon className="h-3 w-3" />}
            {demand.demand_types.name}
          </Badge>
        )}

        {/* Area badge */}
        {demand.demand_areas && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: demand.demand_areas.color ?? undefined,
              color: demand.demand_areas.color ?? undefined,
            }}
          >
            {demand.demand_areas.name}
          </Badge>
        )}

        {/* Priority badge */}
        <Badge className={cn("text-xs border-0", PRIORITY_CLASSES[demand.priority])}>
          {PRIORITY_LABELS[demand.priority]}
        </Badge>

        {/* Blocked badge */}
        {demand.is_blocked && (
          <Badge className="text-xs bg-red-100 text-red-700 border-0 dark:bg-red-950 dark:text-red-300">
            <Lock className="h-3 w-3 mr-0.5" /> Bloqueado
          </Badge>
        )}

        {/* Worked hours badge */}
        {demand.total_hours != null && demand.total_hours > 0 && (
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="h-3 w-3" /> {formatHours(demand.total_hours)}
          </Badge>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate max-w-28">
          {demand.clients?.name}
        </span>
        {demand.created_at && (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(demand.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        )}
      </div>

      {(demand.user_profiles?.full_name ?? demand.user_profiles?.email) && (
        <p className="text-xs text-muted-foreground mt-1 truncate">→ {demand.user_profiles?.full_name ?? demand.user_profiles?.email}</p>
      )}
    </div>
  );
}
