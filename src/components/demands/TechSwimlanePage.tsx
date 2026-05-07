import type { CSSProperties } from "react";
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

  const expandedCols = useMemo(() => columns.filter((c) => !isCollapsed(c.id)), [columns, isCollapsed]);
  const collapsedCols = useMemo(() => columns.filter((c) => isCollapsed(c.id)), [columns, isCollapsed]);

  const gridTemplate = useMemo(
    () => `180px ${expandedCols.map(() => "300px").join(" ")}`,
    [expandedCols]
  );

  const columnCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of demands) map.set(d.column_id, (map.get(d.column_id) ?? 0) + 1);
    return map;
  }, [demands]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto px-6 py-4">
          <div className="min-w-max space-y-2">
            <div className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
              <div />
              {expandedCols.map((col) => (
                <KanbanColumnHeader
                  key={col.id}
                  column={col}
                  count={columnCounts.get(col.id) ?? 0}
                  isCollapsed={false}
                  onToggle={() => toggleCollapse(col.id)}
                />
              ))}
            </div>

            {lanes.map((area) => (
              <SwimlaneLane
                key={area?.id ?? NO_AREA}
                area={area}
                columns={expandedCols}
                gridTemplate={gridTemplate}
                demands={demands.filter((d) => (area ? d.area_id === area.id : !d.area_id))}
                onCardClick={(d) => navigate(`/demands/${d.id}`)}
                taskCounts={taskCounts}
                collaboratorsByDemand={collaboratorsByDemand}
                blockerTypesById={blockerTypesById}
              />
            ))}
          </div>
        </div>

        {collapsedCols.length > 0 && (
          <aside className="shrink-0 flex flex-col gap-2 py-4 pr-4 pl-2 border-l border-border/50">
            {collapsedCols.map((col) => (
              <CollapsedColumnStub
                key={col.id}
                column={col}
                count={columnCounts.get(col.id) ?? 0}
                onClick={() => toggleCollapse(col.id)}
              />
            ))}
          </aside>
        )}
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
  taskCounts?: Record<string, { total: number; done: number }>;
  collaboratorsByDemand?: Record<string, DemandCollaborator[]>;
  blockerTypesById?: Record<string, BlockerType>;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function SwimlaneLane({ area, columns, gridTemplate, demands, onCardClick, taskCounts, collaboratorsByDemand, blockerTypesById }: LaneProps) {
  const bgStyle = area?.background_color
    ? { backgroundColor: hexToRgba(area.background_color, 0.12) }
    : undefined;
  return (
    <div
      className="grid gap-2 rounded-lg border border-border bg-card/40 p-2"
      style={{ gridTemplateColumns: gridTemplate, ...(bgStyle ?? {}) }}
    >
      <div className="flex items-start gap-2 px-2 py-2 rounded-md" style={bgStyle}>
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
          bgStyle={bgStyle}
          taskCounts={taskCounts}
          collaboratorsByDemand={collaboratorsByDemand}
          blockerTypesById={blockerTypesById}
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
  bgStyle?: CSSProperties;
  taskCounts?: Record<string, { total: number; done: number }>;
  collaboratorsByDemand?: Record<string, DemandCollaborator[]>;
  blockerTypesById?: Record<string, BlockerType>;
}

function SwimlaneCell({ areaId, columnId, demands, onCardClick, bgStyle, taskCounts, collaboratorsByDemand, blockerTypesById }: CellProps) {
  const id = `${areaId ?? NO_AREA}::${columnId}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-20 rounded-md p-1.5 space-y-1.5 transition-colors",
        isOver ? "ring-2 ring-primary/30" : "",
        !bgStyle && (isOver ? "bg-primary/5" : "bg-muted/20"),
      )}
      style={bgStyle}
    >
      {demands.map((d) => (
        <div key={d.id} className="max-w-[280px]">
          <DraggableDemandCard
            demand={d}
            onClick={() => onCardClick(d)}
            taskCounts={taskCounts}
            collaborators={collaboratorsByDemand?.[d.id]}
            blockerType={d.blocker_type_id ? blockerTypesById?.[d.blocker_type_id] ?? null : null}
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
  collaborators,
  blockerType,
}: {
  demand: DemandRow;
  onClick: () => void;
  taskCounts?: Record<string, { total: number; done: number }>;
  collaborators?: DemandCollaborator[];
  blockerType?: BlockerType | null;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: demand.id,
  });
  return (
    <DemandCard
      demand={demand}
      taskCounts={taskCounts}
      collaborators={collaborators}
      blockerType={blockerType}
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

