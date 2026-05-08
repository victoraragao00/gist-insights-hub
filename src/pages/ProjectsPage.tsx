import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronDown, ChevronRight, List, FolderTree, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjects, useProjectStats, type ProjectRow } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectsCalendarView, type CalendarMode } from "@/components/projects/ProjectsCalendarView";
import { statusConfig, type ProjectStatus } from "@/lib/projectStatus";

const FILTERS = ["Todos", "Planejamento", "Ativo", "Concluído"] as const;
type Filter = (typeof FILTERS)[number];
type ViewMode = "list" | "grouped" | "calendar";

const VIEW_KEY = "projects:viewMode";
const CAL_MODE_KEY = "projects:calendarMode";

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects("tech");
  const [filter, setFilter] = useState<Filter>("Todos");
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "grouped" || stored === "calendar") return stored;
    return "list";
  });
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    if (typeof window === "undefined") return "planned";
    const stored = window.localStorage.getItem(CAL_MODE_KEY);
    return stored === "actual" ? "actual" : "planned";
  });

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, viewMode);
  }, [viewMode]);
  useEffect(() => {
    window.localStorage.setItem(CAL_MODE_KEY, calendarMode);
  }, [calendarMode]);

  // Build groups by client (only used when viewMode === "grouped")
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; isInternal: boolean; projects: ProjectRow[] }>();
    for (const p of projects) {
      const key = p.is_internal
        ? "__internal__"
        : (p.client_id ?? "__nocli__");
      const label = p.is_internal
        ? "Internos (uMode)"
        : (p.clients?.name ?? "Sem cliente");
      if (!map.has(key)) {
        map.set(key, { key, label, isInternal: !!p.is_internal, projects: [] });
      }
      map.get(key)!.projects.push(p);
    }
    return Array.from(map.values()).sort((a, b) => {
      // "Internos" goes last
      if (a.isInternal && !b.isInternal) return 1;
      if (!a.isInternal && b.isInternal) return -1;
      return a.label.localeCompare(b.label, "pt-BR");
    });
  }, [projects]);

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

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
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

        <div className="inline-flex items-center rounded-full border border-border p-0.5 bg-background">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-colors",
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grouped")}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-colors",
              viewMode === "grouped"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FolderTree className="h-3.5 w-3.5" /> Agrupado por cliente
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-colors",
              viewMode === "calendar"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendário
          </button>
        </div>
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
      ) : viewMode === "list" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCardFiltered key={p.id} project={p} filter={filter} />
          ))}
        </div>
      ) : viewMode === "grouped" ? (
        <div className="space-y-4">
          {groups.map((g) => (
            <ClientGroup key={g.key} groupKey={g.key} label={g.label} projects={g.projects} filter={filter} />
          ))}
        </div>
      ) : (
        <ProjectsCalendarView
          projects={projects}
          mode={calendarMode}
          onModeChange={setCalendarMode}
        />
      )}

      <CreateProjectDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function ProjectCardFiltered({
  project,
  filter,
  onMatchChange,
}: {
  project: ProjectRow;
  filter: Filter;
  onMatchChange?: (matches: boolean) => void;
}) {
  const { data: stats } = useProjectStats(project.id);
  const status = (stats?.status ?? "planning") as ProjectStatus;
  const matches = filter === "Todos" || statusConfig[status].label === filter;
  useEffect(() => {
    onMatchChange?.(matches);
  }, [matches, onMatchChange]);
  if (!matches) return null;
  return <ProjectCard project={project} />;
}

function ClientGroup({
  groupKey,
  label,
  projects,
  filter,
}: {
  groupKey: string;
  label: string;
  projects: ProjectRow[];
  filter: Filter;
}) {
  const [open, setOpen] = useState(true);
  const [matches, setMatches] = useState<Record<string, boolean>>({});

  const visibleCount = projects.reduce(
    (n, p) => n + (matches[p.id] !== false ? 1 : 0),
    0,
  );

  // Hide whole group if filter excludes all (only when we already know matches)
  const allKnown = projects.every((p) => p.id in matches);
  if (allKnown && visibleCount === 0) return null;

  return (
    <section className="border border-border rounded-2xl bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground">
            · {visibleCount} projeto{visibleCount !== 1 ? "s" : ""}
            {filter !== "Todos" && projects.length !== visibleCount && (
              <span className="ml-1">de {projects.length}</span>
            )}
          </span>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 pt-2">
          {projects.map((p) => (
            <ProjectCardFiltered
              key={`${groupKey}-${p.id}`}
              project={p}
              filter={filter}
              onMatchChange={(m) =>
                setMatches((prev) => (prev[p.id] === m ? prev : { ...prev, [p.id]: m }))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
