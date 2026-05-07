import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  title: string;
  icon: string;
  tone?: "default" | "destructive";
  onRemove?: () => void;
}

export function DependencyChip({ id, title, icon, tone = "default", onRemove }: Props) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 py-1 px-1.5 rounded text-xs",
        tone === "destructive" && "bg-destructive/5 border border-destructive/20",
      )}
    >
      <span aria-hidden>{icon}</span>
      <Link
        to={`/demands/${id}`}
        className={cn(
          "flex-1 truncate hover:underline",
          tone === "destructive" ? "text-destructive font-medium" : "hover:text-primary",
        )}
      >
        {title}
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover relação"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
