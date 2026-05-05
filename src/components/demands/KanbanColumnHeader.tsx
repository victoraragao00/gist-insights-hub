import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

interface KanbanColumnHeaderProps {
  column: Pick<Tables<"ticket_columns">, "id" | "name" | "color">;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onAddDemand?: () => void;
}

export function KanbanColumnHeader({
  column,
  count,
  isCollapsed,
  onToggle,
  onAddDemand,
}: KanbanColumnHeaderProps) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between px-3 py-2 rounded-md",
        "cursor-pointer select-none hover:bg-muted/40 transition-colors",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: column.color ?? "hsl(var(--muted-foreground))" }}
        />
        <span className="text-sm font-semibold truncate text-foreground">{column.name}</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
          {count}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {onAddDemand && !isCollapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddDemand();
            }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Adicionar demanda"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isCollapsed && "-rotate-90",
          )}
        />
      </div>
    </div>
  );
}
