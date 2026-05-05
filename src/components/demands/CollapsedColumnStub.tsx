import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

interface CollapsedColumnStubProps {
  column: Pick<Tables<"ticket_columns">, "id" | "name" | "color">;
  count: number;
  onClick: () => void;
  isOver?: boolean;
}

export const CollapsedColumnStub = forwardRef<HTMLDivElement, CollapsedColumnStubProps>(
  function CollapsedColumnStub({ column, count, onClick, isOver }, ref) {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          "flex flex-col items-center w-12 min-w-[48px] h-full py-3 gap-2",
          "rounded-lg border border-border bg-card cursor-pointer select-none",
          "transition-colors hover:bg-muted/60",
          isOver && "ring-2 ring-primary/20",
        )}
        title={`${column.name} — expandir`}
      >
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: column.color ?? "hsl(var(--muted-foreground))" }}
        />
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
          {count}
        </span>
        <span className="flex-1 flex items-center justify-center text-xs font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180 tracking-wide">
          {column.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground -rotate-90 shrink-0" />
      </div>
    );
  },
);
