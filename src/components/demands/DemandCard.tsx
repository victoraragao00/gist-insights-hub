import { Badge } from "@/components/ui/badge";
import { Lock, Clock, CheckSquare, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatHours } from "@/lib/formatHours";
import { getDemandCardData } from "@/lib/demandCardData";
import { cn } from "@/lib/utils";
import type { DemandRow, DemandPriority } from "@/hooks/useDemands";
import type { CSSProperties } from "react";

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

export interface DemandCardProps {
  demand: DemandRow;
  taskCounts?: Record<string, { total: number; done: number }>;
  hoursTotals?: Record<string, number>;
  onClick?: () => void;
  // DnD props (optional, supplied by drag wrappers)
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  dragRef?: (node: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
  isDragging?: boolean;
}

export function DemandCard({
  demand,
  taskCounts,
  hoursTotals,
  onClick,
  dragAttributes,
  dragListeners,
  dragRef,
  dragStyle,
  isDragging,
}: DemandCardProps) {
  const navigate = useNavigate();
  const d = getDemandCardData(demand, taskCounts, hoursTotals);

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/demands/${demand.id}`);
  };

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      {...(dragAttributes ?? {})}
      {...(dragListeners ?? {})}
      onClick={handleClick}
      className={cn(
        "border border-border rounded-xl p-3 bg-card",
        "hover:border-primary/40 hover:shadow-sm transition-all",
        dragListeners ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-50 ring-2 ring-primary/30 shadow-lg",
        demand.is_blocked && "border-destructive/30",
      )}
    >
      {/* Linha 1: Tipo + Área + Prioridade */}
      <div className="flex flex-wrap items-center gap-1.5">
        {d.typeName && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4"
            style={{
              borderColor: d.typeColor ?? undefined,
              color: d.typeColor ?? undefined,
            }}
          >
            {d.typeName}
          </Badge>
        )}
        {d.areaName && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4"
            style={{
              borderColor: d.areaColor ?? undefined,
              color: d.areaColor ?? undefined,
            }}
          >
            {d.areaName}
          </Badge>
        )}
        <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", PRIORITY_CLASSES[demand.priority])}>
          {PRIORITY_LABELS[demand.priority]}
        </Badge>
      </div>

      {/* Título */}
      <p className="mt-2 text-sm font-medium text-foreground line-clamp-2">
        {demand.title}
      </p>

      {/* Linha 3: Bloqueado + Aging */}
      {(demand.is_blocked || d.aging) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {demand.is_blocked && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 border-0 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <Lock className="h-3 w-3 mr-0.5" /> Bloqueado
            </Badge>
          )}
          {d.aging && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", d.aging.className)}>
              {d.aging.label}
            </Badge>
          )}
        </div>
      )}

      {/* Linha 4: Cliente + tempo */}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{d.clientName ?? "—"}</span>
        {d.createdAgo && <span className="shrink-0">há {d.createdAgo}</span>}
      </div>

      {/* Linha 5: Responsável + chips */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {d.assigneeInitials ? (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
              {d.assigneeInitials}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground shrink-0">
              <User className="h-3 w-3" />
            </span>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {d.assigneeName ?? "—"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {d.totalHours > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
              <Clock className="h-3 w-3" />
              {formatHours(d.totalHours)}
            </Badge>
          )}
          {d.taskCount && d.taskCount.total > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4 gap-0.5",
                d.taskCount.done === d.taskCount.total &&
                  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
              )}
              title={`${d.taskCount.done} de ${d.taskCount.total} subdemandas`}
            >
              <CheckSquare className="h-3 w-3" />
              {d.taskCount.done}/{d.taskCount.total}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
