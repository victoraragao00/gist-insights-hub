import { useMemo, useCallback, Fragment } from "react";
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
import type { Tables } from "@/integrations/supabase/types";

const NO_AREA = "no-area";

interface Props {
  columns: Tables<"ticket_columns">[];
  demands: DemandRow[];
  taskCounts?: Record<string, { total: number; done: number }>;
}

export function TechSwimlanePage({ columns, demands, taskCounts }: Props) {
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

  // Total grid rows = 1 (header) + lanes.length
  const totalRows = lanes.length + 1;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-auto px-6 py-4">
        <div className="min-w-max">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: gridTemplate,
              transition: "grid-template-columns 0.2s",
            }}
          >
            {/* Header row — top-left empty cell */}
            <div />
            {columns.map((col) => {
              if (isCollapsed(col.id)) {
                // Slot reservado — o stub full-height será posicionado depois
                return <div key={`h-${col.id}`} aria-hidden />;
              }
              return (
                <KanbanColumnHeader
                  key={`h-${col.id}`}
                  column={col}
                  count={columnCounts.get(col.id) ?? 0}
                  isCollapsed={false}
                  onToggle={() => toggleCollapse(col.id)}
                />
              );
            })}

            {/* Lanes */}
            {lanes.map((area) => {
              const laneDemands = demands.filter((d) =>
                area ? d.area_id === area.id : !d.area_id
              );
              return (
                <Fragment key={area?.id ?? NO_AREA}>
                  <LaneLabel area={area} count={laneDemands.length} />
                  {columns.map((col) => {
                    if (isCollapsed(col.id)) {
                      return <div key={`${area?.id ?? NO_AREA}-${col.id}`} aria-hidden />;
                    }
                    return (
                      <SwimlaneCell
                        key={`${area?.id ?? NO_AREA}-${col.id}`}
                        areaId={area?.id ?? null}
                        columnId={col.id}
                        demands={laneDemands.filter((d) => d.column_id === col.id)}
                        onCardClick={(d) => navigate(`/demands/${d.id}`)}
                        taskCounts={taskCounts}
                      />
                    );
                  })}
                </Fragment>
              );
            })}

            {/* Stubs colapsados — atravessam header + todas as raias */}
            {columns.map((col, idx) =>
              isCollapsed(col.id) ? (
                <div
                  key={`stub-${col.id}`}
                  style={{
                    gridColumn: idx + 2,
                    gridRow: `1 / span ${totalRows}`,
                  }}
                >
                  <CollapsedColumnStub
                    column={col}
                    count={columnCounts.get(col.id) ?? 0}
                    onClick={() => toggleCollapse(col.id)}
                  />
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function LaneLabel({ area, count }: { area: DemandArea | null; count: number }) {
  return (
    <div className="flex items-start gap-2 px-2 py-2 rounded-lg border border-border bg-card/40">
      {area ? (
        <>
          <div
            className="h-3 w-3 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: area.color ?? "hsl(var(--muted-foreground))" }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{area.name}</p>
            <p className="text-xs text-muted-foreground">
              {count} demanda{count !== 1 ? "s" : ""}
            </p>
          </div>
        </>
      ) : (
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Sem área</p>
          <p className="text-xs text-muted-foreground">
            {count} demanda{count !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

interface CellProps {
  areaId: string | null;
  columnId: string;
  demands: DemandRow[];
  onCardClick: (d: DemandRow) => void;
  taskCounts?: Record<string, { total: number; done: number }>;
}

function SwimlaneCell({ areaId, columnId, demands, onCardClick, taskCounts }: CellProps) {
  const id = `${areaId ?? NO_AREA}::${columnId}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-20 rounded-md p-1.5 space-y-1.5 transition-colors border border-border bg-card/40",
        isOver && "bg-primary/5 ring-2 ring-primary/20"
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
