import { Badge } from "@/components/ui/badge";
import { Lock, Clock, CheckSquare, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatHours } from "@/lib/formatHours";
import { getDemandCardData } from "@/lib/demandCardData";
import { cn } from "@/lib/utils";
import { priorityBadgeClass, priorityLabel } from "./detail/priorityBadgeStyles";
import type { DemandRow } from "@/hooks/useDemands";
import type { DemandCollaborator } from "@/hooks/useDemandCollaborators";
import type { BlockerType } from "@/hooks/useBlockerTypes";
import type { CSSProperties } from "react";

export interface DemandCardDraggable {
  ref: (node: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown>;
  isDragging: boolean;
  style?: CSSProperties;
}

export interface DemandCardProps {
  demand: DemandRow;
  taskCounts?: Record<string, { total: number; done: number }>;
  hoursTotals?: Record<string, number>;
  collaborators?: DemandCollaborator[];
  blockerType?: BlockerType | null;
  onClick?: () => void;
  draggable?: DemandCardDraggable;
}

function getCollabInitials(c: DemandCollaborator): string {
  const source = c.full_name || c.email || "?";
  const clean = source.includes("@") ? source.split("@")[0] : source;
  const parts = clean.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

export function DemandCard({
  demand,
  taskCounts,
  hoursTotals,
  collaborators,
  blockerType,
  onClick,
  draggable,
}: DemandCardProps) {
  const navigate = useNavigate();
  const d = getDemandCardData(demand, taskCounts, hoursTotals);
  const collabs = collaborators ?? [];
  const visibleCollabs = collabs.slice(0, 2);
  const remaining = collabs.length - visibleCollabs.length;

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/demands/${demand.id}`);
  };

  return (
    <div
      ref={draggable?.ref}
      style={draggable?.style}
      {...(draggable?.attributes ?? {})}
      {...(draggable?.listeners ?? {})}
      onClick={handleClick}
      className={cn(
        "border border-border rounded-xl p-3 bg-card w-full",
        "transition-all select-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        "hover:border-primary/40 hover:shadow-sm",
        demand.is_blocked && "border-destructive/30",
        draggable?.isDragging && "opacity-50 ring-2 ring-primary/30 shadow-lg",
      )}
    >
      {/* Linha 1: Tipo + Área + Prioridade */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {d.typeName && (
          <Badge
            variant="outline"
            className="text-[11px] px-1.5 py-0 h-5 bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900"
          >
            {d.typeName}
          </Badge>
        )}
        {d.areaName && (
          <Badge
            variant="outline"
            className="text-[11px] px-1.5 py-0 h-5 bg-muted/60 text-muted-foreground border-border"
          >
            {d.areaName}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={cn("text-[11px] px-1.5 py-0 h-5", priorityBadgeClass(demand.priority))}
        >
          {priorityLabel(demand.priority)}
        </Badge>
      </div>

      {/* Título */}
      <p className="text-sm font-medium leading-snug line-clamp-2 break-words mb-2 text-foreground">
        {demand.title}
      </p>

      {/* Bloqueado + Aging */}
      {(demand.is_blocked || d.aging) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {demand.is_blocked && (
            <Badge
              variant="outline"
              className="text-[11px] px-1.5 py-0 h-5 bg-destructive/10 text-destructive border-destructive/30 gap-1"
            >
              {blockerType?.icon ? (
                <span aria-hidden>{blockerType.icon}</span>
              ) : (
                <Lock className="h-2.5 w-2.5" />
              )}
              <span className="truncate max-w-[140px]">
                {blockerType?.name ?? "Bloqueado"}
              </span>
            </Badge>
          )}
          {d.aging && (
            <Badge variant="outline" className={cn("text-[11px] px-1.5 py-0 h-5", d.aging.className)}>
              {d.aging.label}
            </Badge>
          )}
        </div>
      )}

      {demand.is_blocked && demand.blocker_reason?.startsWith("Aguardando conclusão de:") && (
        <p className="text-[10px] text-destructive/80 mb-2 line-clamp-1">
          {demand.blocker_reason}
        </p>
      )}

      {/* Cliente + tempo */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="truncate">{d.clientName ?? "—"}</span>
        {d.createdAgo && <span className="shrink-0 ml-2">há {d.createdAgo}</span>}
      </div>

      {/* Responsável + colaboradores + chips */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          {/* Stack de avatares */}
          <div className="flex items-center shrink-0">
            <div
              className={cn(
                "w-5 h-5 rounded-full text-[9px] font-semibold flex items-center justify-center shrink-0 ring-2 ring-background relative z-30",
                d.assigneeInitials
                  ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                  : "bg-muted text-muted-foreground",
              )}
              title={d.assigneeName ? `Responsável: ${d.assigneeName}` : "Sem responsável"}
            >
              {d.assigneeInitials ?? <User className="h-2.5 w-2.5" />}
            </div>
            {visibleCollabs.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  "w-5 h-5 rounded-full text-[9px] font-semibold flex items-center justify-center shrink-0 ring-2 ring-background -ml-1.5",
                  "bg-muted text-foreground/70",
                )}
                style={{ zIndex: 20 - i }}
                title={c.full_name || c.email || "Colaborador"}
              >
                {getCollabInitials(c)}
              </div>
            ))}
            {remaining > 0 && (
              <div
                className="w-5 h-5 rounded-full text-[9px] font-semibold flex items-center justify-center shrink-0 ring-2 ring-background -ml-1.5 bg-muted/80 text-muted-foreground"
                title={`+${remaining} colaboradores`}
              >
                +{remaining}
              </div>
            )}
          </div>
          <span className="truncate">{d.assigneeName ?? "—"}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {d.totalHours > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
              <Clock className="h-3 w-3" />
              {formatHours(d.totalHours)}
            </span>
          )}
          {d.taskCount && d.taskCount.total > 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium border rounded-full px-1.5 py-0.5",
                d.taskCount.done === d.taskCount.total
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900"
                  : "bg-muted text-muted-foreground border-border",
              )}
              title={`${d.taskCount.done} de ${d.taskCount.total} subdemandas`}
            >
              <CheckSquare className="h-3 w-3" />
              {d.taskCount.done}/{d.taskCount.total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
