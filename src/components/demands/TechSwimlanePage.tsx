import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DemandCard } from "./DemandCard";
import { KanbanColumnHeader } from "./KanbanColumnHeader";
import { CollapsedColumnStub } from "./CollapsedColumnStub";
import type { DemandRow } from "@/hooks/useDemands";
import { useMoveDemand, useUpdateDemand } from "@/hooks/useDemands";
import { useAreasByWorkspace, type DemandArea } from "@/hooks/useDemandAreas";
import { useCollapsedColumns } from "@/hooks/useCollapsedColumns";
import type { DemandCollaborator } from "@/hooks/useDemandCollaborators";
import type { BlockerType } from "@/hooks/useBlockerTypes";
import type { Tables } from "@/integrations/supabase/types";

const NO_AREA = "no-area";

interface Props {
  columns: Tables<"ticket_columns">[];
  demands: DemandRow[];
  taskCounts?: Record<string, { total: number; done: number }>;
  collaboratorsByDemand?: Record<string, DemandCollaborator[]>;
  blockerTypesById?: Record<string, BlockerType>;
}

export function TechSwimlanePage({ columns, demands, taskCounts, collaboratorsByDemand, blockerTypesById }: Props) {
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
      `180px ${columns
        .map((c) => (isCollapsed(c.id) ? "48px" : "300px"))
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
      <div className="h-full overflow-x-auto px-6 py-4">
        <div className="min-w-max space-y-2">
          {/* Header */}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: gridTemplate, transition: "grid-template-columns 0.2s" }}
          >
            <div />
            {columns.map((col) => {
              const collapsed = isCollapsed(col.id);
              const count = columnCounts.get(col.id) ?? 0;
              if (collapsed) {
                return (
                  <CollapsedColumnStub
                    key={col.id}
                    column={col}
                    count={count}
                    onClick={() => toggleCollapse(col.id)}
                  />
                );
              }
              return (
                <KanbanColumnHeader
                  key={col.id}
                  column={col}
                  count={count}
                  isCollapsed={false}
                  onToggle={() => toggleCollapse(col.id)}
                />
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
              taskCounts={taskCounts}
              collaboratorsByDemand={collaboratorsByDemand}
              blockerTypesById={blockerTypesById}
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
  taskCounts?: Record<string, { total: number; done: number }>;
}

function SwimlaneLane({ area, columns, gridTemplate, demands, onCardClick, isCollapsed, taskCounts }: LaneProps) {
  return (
    <div
      className="grid gap-2 rounded-lg border border-border bg-card/40 p-2"
      style={{ gridTemplateColumns: gridTemplate, transition: "grid-template-columns 0.2s" }}
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
          taskCounts={taskCounts}
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
  taskCounts?: Record<string, { total: number; done: number }>;
}

function SwimlaneCell({ areaId, columnId, demands, onCardClick, collapsed, taskCounts }: CellProps) {
  const id = `${areaId ?? NO_AREA}::${columnId}`;
  const { setNodeRef, isOver } = useDroppable({ id, disabled: collapsed });

  if (collapsed) {
    return <div className="bg-muted/10" aria-hidden />;
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
        <div key={d.id} className="max-w-[280px]">
          <DraggableDemandCard
            demand={d}
            onClick={() => onCardClick(d)}
            taskCounts={taskCounts}
          />
        </div>
      ))}
      {demands.length === 0 && <div className="h-12" aria-hidden />}
    </div>
  );
}

function DraggableDemandCard({
  demand,
  onClick,
  taskCounts,
}: {
  demand: DemandRow;
  onClick: () => void;
  taskCounts?: Record<string, { total: number; done: number }>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: demand.id,
  });
  return (
    <DemandCard
      demand={demand}
      taskCounts={taskCounts}
      onClick={onClick}
      draggable={{
        ref: setNodeRef,
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: (listeners ?? {}) as unknown as Record<string, unknown>,
        isDragging,
        style: { transform: CSS.Translate.toString(transform) },
      }}
    />
  );
}
