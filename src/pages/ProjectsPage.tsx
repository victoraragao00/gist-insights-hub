import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";

const FILTERS = ["Todos", "Planejamento", "Ativo", "Concluído"] as const;
type Filter = (typeof FILTERS)[number];

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects("tech");
  const [filter, setFilter] = useState<Filter>("Todos");
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} projeto{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo projeto
        </Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Nenhum projeto criado ainda.
          </p>
          <Button onClick={() => setShowCreate(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" /> Criar primeiro projeto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCardFiltered key={p.id} project={p} filter={filter} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

import { useProjectStats, type ProjectRow } from "@/hooks/useProjects";
import { statusConfig, type ProjectStatus } from "@/lib/projectStatus";

function ProjectCardFiltered({
  project,
  filter,
}: {
  project: ProjectRow;
  filter: Filter;
}) {
  const { data: stats } = useProjectStats(project.id);
  const status = (stats?.status ?? "planning") as ProjectStatus;
  if (filter !== "Todos" && statusConfig[status].label !== filter) return null;
  return <ProjectCard project={project} />;
}
