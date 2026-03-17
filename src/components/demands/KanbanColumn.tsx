import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
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
}

export function KanbanColumn({ column, demands, onCardClick, onAddClick }: KanbanColumnProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-64 max-w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-0.5 rounded hover:bg-accent"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
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
          onClick={() => onAddClick(column.id)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Drop zone */}
      {!collapsed && (
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
      )}
    </div>
  );
}
