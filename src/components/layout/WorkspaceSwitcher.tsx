import { Users, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/hooks/useWorkspace";

interface Props {
  active: Workspace;
  onChange: (ws: Workspace) => void;
}

export function WorkspaceSwitcher({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 mx-2 mb-3">
      <button
        type="button"
        onClick={() => onChange("cx")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
          active === "cx"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Users className="h-3 w-3" />
        CX Hub
      </button>
      <button
        type="button"
        onClick={() => onChange("tech")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
          active === "tech"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Code2 className="h-3 w-3" />
        TECH
      </button>
    </div>
  );
}
