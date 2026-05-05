import { cn } from "@/lib/utils";
import type { DemandArea } from "@/hooks/useDemandAreas";
import type { ProjectRow } from "@/hooks/useProjects";

interface Props {
  areas?: DemandArea[];
  projects?: ProjectRow[];
  selectedArea: string | null;
  selectedProject: string | null;
  onAreaChange: (id: string | null) => void;
  onProjectChange: (id: string | null) => void;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1 rounded-full border transition-all whitespace-nowrap",
        active
          ? "bg-foreground text-background border-foreground"
          : "border-border text-muted-foreground hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

export function FilterChips({
  areas,
  projects,
  selectedArea,
  selectedProject,
  onAreaChange,
  onProjectChange,
}: Props) {
  const techAreas = (areas ?? []).filter(
    (a) => a.workspace === "tech" || a.workspace === "both",
  );
  const techProjects = (projects ?? []).filter((p) => p.workspace === "tech");

  return (
    <div className="space-y-2">
      {techAreas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
            Área
          </span>
          <Chip active={selectedArea === null} onClick={() => onAreaChange(null)}>
            Todas
          </Chip>
          {techAreas.map((a) => (
            <Chip
              key={a.id}
              active={selectedArea === a.id}
              onClick={() => onAreaChange(selectedArea === a.id ? null : a.id)}
            >
              {a.name}
            </Chip>
          ))}
        </div>
      )}
      {techProjects.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
            Projeto
          </span>
          <Chip
            active={selectedProject === null}
            onClick={() => onProjectChange(null)}
          >
            Todos
          </Chip>
          {techProjects.slice(0, 12).map((p) => (
            <Chip
              key={p.id}
              active={selectedProject === p.id}
              onClick={() =>
                onProjectChange(selectedProject === p.id ? null : p.id)
              }
            >
              {p.title}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
