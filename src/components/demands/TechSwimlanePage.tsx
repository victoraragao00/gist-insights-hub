import { useMemo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAgingDays, getAgingStyle } from "@/lib/getAgingStyle";
import type { DemandRow, DemandPriority } from "@/hooks/useDemands";
import { useMoveDemand, useUpdateDemand } from "@/hooks/useDemands";
import { useAreasByWorkspace, type DemandArea } from "@/hooks/useDemandAreas";
import { useCollapsedColumns } from "@/hooks/useCollapsedColumns";
import type { Tables } from "@/integrations/supabase/types";

const PRIORITY_CLASSES: Record<DemandPriority, string> = {
  urgent: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  high: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  medium: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950",
  low: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
};

const PRIORITY_LABELS: Record<DemandPriority, string> = {
  urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa",
};

const NO_AREA = "no-area";

interface Props {
  columns: Tables<"ticket_columns">[];
  demands: DemandRow[];
}

export function TechSwimlanePage({ columns, demands }: Props) {
  const { data: areas = [] } = useAreasByWorkspace("tech");
  const moveMutation = useMoveDemand();
  const updateMutation = useUpdateDemand();
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const lanes = useMemo<(DemandArea | null)[]>(() => [...areas, null], [areas]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const demandId = String(active.id);
    const overId = String(over.id);
    const sep = overId.indexOf("::");
    if (sep === -1) return;
    const targetAreaRaw = overId.slice(0, sep);
    const targetColumnId = overId.slice(sep + 2);
    const targetAreaId = targetAreaRaw === NO_AREA ? null : targetAreaRaw;

    const demand = demands.find((d) => d.id === demandId);
    if (!demand) return;

    if (demand.column_id !== targetColumnId) {
      const targetCol = columns.find((c) => c.id === targetColumnId);
      if (targetCol) {
        moveMutation.mutate({
          demandId,
          targetColumnId,
          targetPosition: 0,
          sourceColumnName: demand.ticket_columns?.name ?? "",
          targetColumnName: targetCol.name,
          currentStartedAt: demand.started_at,
          targetTriggersStartedAt: targetCol.triggers_started_at ?? false,
          targetTriggersFinishedAt: targetCol.triggers_finished_at ?? false,
        });
      }
    }

    if ((demand.area_id ?? null) !== targetAreaId) {
      updateMutation.mutate({
        id: demandId,
        fields: { area_id: targetAreaId },
        fieldLabel: "Área",
      });
    }
  }, [demands, columns, moveMutation, updateMutation]);

  const { isCollapsed, toggle: toggleCollapse } = useCollapsedColumns(columns);

  const gridTemplate = useMemo(
    () =>
      `160px ${columns
        .map((c) => (isCollapsed(c.id) ? "48px" : "minmax(220px, 1fr)"))
        .join(" ")}`,
    [columns, isCollapsed]
  );

  const columnCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of demands) map.set(d.column_id, (map.get(d.column_id) ?? 0) + 1);
    return map;
  }, [demands]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="min-w-max space-y-2">
          {/* Header */}
          <div className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
            <div />
            {columns.map((col) => {
              const collapsed = isCollapsed(col.id);
              const count = columnCounts.get(col.id) ?? 0;
              return (
                <div
                  key={col.id}
                  onClick={() => toggleCollapse(col.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded cursor-pointer select-none",
                    "hover:bg-muted/60 transition-colors",
                    collapsed && "justify-center"
                  )}
                  title={collapsed ? `${col.name} — expandir` : "Colapsar coluna"}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: col.color ?? "hsl(var(--muted-foreground))" }}
                  />
                  {collapsed ? (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {count}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-foreground truncate">{col.name}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-muted-foreground/60 ml-auto transition-transform duration-200",
                      collapsed && "-rotate-90 ml-0"
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Lanes */}
          {lanes.map((area) => (
            <SwimlaneLane
              key={area?.id ?? NO_AREA}
              area={area}
              columns={columns}
              gridTemplate={gridTemplate}
              demands={demands.filter((d) =>
                area ? d.area_id === area.id : !d.area_id
              )}
              onCardClick={(d) => navigate(`/demands/${d.id}`)}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

interface LaneProps {
  area: DemandArea | null;
  columns: Tables<"ticket_columns">[];
  gridTemplate: string;
  demands: DemandRow[];
  onCardClick: (d: DemandRow) => void;
  isCollapsed: (id: string) => boolean;
}

function SwimlaneLane({ area, columns, gridTemplate, demands, onCardClick, isCollapsed }: LaneProps) {
  return (
    <div
      className="grid gap-2 rounded-lg border border-border bg-card/40 p-2"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {/* Lane label */}
      <div className="flex items-start gap-2 px-2 py-2">
        {area ? (
          <>
            <div
              className="h-3 w-3 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: area.color ?? "hsl(var(--muted-foreground))" }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{area.name}</p>
              <p className="text-xs text-muted-foreground">
                {demands.length} demanda{demands.length !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Sem área</p>
            <p className="text-xs text-muted-foreground">
              {demands.length} demanda{demands.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {columns.map((col) => (
        <SwimlaneCell
          key={col.id}
          areaId={area?.id ?? null}
          columnId={col.id}
          demands={demands.filter((d) => d.column_id === col.id)}
          onCardClick={onCardClick}
          collapsed={isCollapsed(col.id)}
        />
      ))}
    </div>
  );
}

interface CellProps {
  areaId: string | null;
  columnId: string;
  demands: DemandRow[];
  onCardClick: (d: DemandRow) => void;
  collapsed: boolean;
}

function SwimlaneCell({ areaId, columnId, demands, onCardClick, collapsed }: CellProps) {
  const id = `${areaId ?? NO_AREA}::${columnId}`;
  const { setNodeRef, isOver } = useDroppable({ id, disabled: collapsed });

  if (collapsed) {
    return <div className="min-h-20 rounded-md bg-muted/10" aria-hidden />;
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-20 rounded-md p-1.5 space-y-1.5 transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/20"
      )}
    >
      {demands.map((d) => (
        <SwimlaneDemandCard key={d.id} demand={d} onClick={() => onCardClick(d)} />
      ))}
      {demands.length === 0 && <div className="h-12" aria-hidden />}
    </div>
  );
}

interface CardProps {
  demand: DemandRow;
  onClick: () => void;
}

function SwimlaneDemandCard({ demand, onClick }: CardProps) {
  const [pressed, setPressed] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: demand.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const aging = getAgingStyle(getAgingDays(demand));
  const assigneeFirst =
    demand.user_profiles?.full_name?.split(" ")[0] ??
    demand.user_profiles?.email ?? null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={() => setPressed(false)}
      onPointerMove={() => setPressed(true)}
      onClick={(e) => {
        if (pressed || isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-md border bg-card p-2 cursor-pointer text-left",
        "transition-shadow duration-200 hover:shadow-md",
        isDragging && "shadow-lg ring-2 ring-primary/20"
      )}
    >
      <p className="text-xs font-medium line-clamp-2 text-foreground">{demand.title}</p>
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", PRIORITY_CLASSES[demand.priority])}>
          {PRIORITY_LABELS[demand.priority]}
        </Badge>
        {assigneeFirst && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
            {assigneeFirst}
          </span>
        )}
        {aging && (
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 ml-auto", aging.className)}>
            {aging.label}
          </Badge>
        )}
      </div>
    </div>
  );
}
