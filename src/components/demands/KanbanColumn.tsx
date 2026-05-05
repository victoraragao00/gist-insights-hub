import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DemandCard } from "./DemandCard";
import { KanbanColumnHeader } from "./KanbanColumnHeader";
import { CollapsedColumnStub } from "./CollapsedColumnStub";
import type { DemandRow } from "@/hooks/useDemands";
import type { DemandCollaborator } from "@/hooks/useDemandCollaborators";
import type { BlockerType } from "@/hooks/useBlockerTypes";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

function SortableDemandCard({
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
        style: { transform: CSS.Transform.toString(transform), transition },
      }}
    />
  );
}

interface KanbanColumnProps {
  column: Tables<"ticket_columns">;
  demands: DemandRow[];
  onCardClick: (demand: DemandRow) => void;
  onAddClick: (columnId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: (columnId: string) => void;
  taskCounts?: Record<string, { total: number; done: number }>;
  collaboratorsByDemand?: Record<string, DemandCollaborator[]>;
  blockerTypesById?: Record<string, BlockerType>;
}

export function KanbanColumn({
  column,
  demands,
  onCardClick,
  onAddClick,
  isCollapsed,
  onToggleCollapse,
  taskCounts,
  collaboratorsByDemand,
  blockerTypesById,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  if (isCollapsed) {
    return (
      <CollapsedColumnStub
        ref={setNodeRef}
        column={column}
        count={demands.length}
        isOver={isOver}
        onClick={() => onToggleCollapse(column.id)}
      />
    );
  }

  return (
    <div className="flex flex-col w-[280px] shrink-0 transition-all duration-200">
      <KanbanColumnHeader
        column={column}
        count={demands.length}
        isCollapsed={false}
        onToggle={() => onToggleCollapse(column.id)}
        onAddDemand={() => onAddClick(column.id)}
      />

      <div
        ref={setNodeRef}
        className={cn(
          "space-y-2 rounded-lg p-2 mt-2 transition-colors",
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30",
        )}
      >
        <SortableContext items={demands.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {demands.map((demand) => (
            <SortableDemandCard
              key={demand.id}
              demand={demand}
              onClick={() => onCardClick(demand)}
              taskCounts={taskCounts}
              collaborators={collaboratorsByDemand?.[demand.id]}
              blockerType={
                demand.blocker_type_id
                  ? blockerTypesById?.[demand.blocker_type_id] ?? null
                  : null
              }
            />
          ))}
        </SortableContext>

        {demands.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Arraste tickets aqui</p>
        )}
      </div>
    </div>
  );
}
