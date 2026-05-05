import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemandCard } from "./DemandCard";
import type { DemandRow } from "@/hooks/useDemands";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  column: Tables<"ticket_columns">;
  demands: DemandRow[];
  onCardClick: (demand: DemandRow) => void;
  onAddClick: (columnId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: (columnId: string) => void;
}

export function KanbanColumn({
  column,
  demands,
  onCardClick,
  onAddClick,
  isCollapsed,
  onToggleCollapse,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={() => onToggleCollapse(column.id)}
        className={cn(
          "flex flex-col items-center shrink-0 w-12 min-w-[48px] py-3 gap-2",
          "rounded-lg border border-border bg-card cursor-pointer select-none",
          "transition-colors hover:bg-muted/60",
          isOver && "ring-2 ring-primary/20"
        )}
        title={`${column.name} — expandir`}
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: column.color ?? "hsl(var(--muted-foreground))" }}
        />
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          {demands.length}
        </span>
        <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180 tracking-wide truncate max-h-48">
          {column.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground -rotate-90 mt-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-64 max-w-72 shrink-0 transition-all duration-200">
      {/* Header — clickable to collapse */}
      <div
        className="flex items-center gap-2 mb-3 px-1 cursor-pointer select-none rounded hover:bg-muted/40 py-1"
        onClick={() => onToggleCollapse(column.id)}
      >
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: column.color ?? "hsl(var(--muted-foreground))" }}
        />
        <span className="text-sm font-semibold text-foreground truncate">{column.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">{demands.length}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onAddClick(column.id);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 rounded-lg p-2 min-h-24 transition-colors",
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        )}
      >
        <SortableContext
          items={demands.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {demands.map((demand) => (
            <DemandCard
              key={demand.id}
              demand={demand}
              onClick={() => onCardClick(demand)}
            />
          ))}
        </SortableContext>

        {demands.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            Arraste tickets aqui
          </p>
        )}
      </div>
    </div>
  );
}
