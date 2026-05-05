import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  XCircle,
  Building2,
  CalendarDays,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import {
  useProject,
  useProjectStats,
  useUpdateProject,
  useCancelProject,
} from "@/hooks/useProjects";
import { useProjectAgendas } from "@/hooks/useMeetingAgendas";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { ProjectDemandsTab } from "@/components/projects/tabs/ProjectDemandsTab";
import { ProjectSquadTab } from "@/components/projects/tabs/ProjectSquadTab";
import { ProjectActivityTab } from "@/components/projects/tabs/ProjectActivityTab";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: project, isLoading } = useProject(id);
  const { data: stats } = useProjectStats(id);
  const updateProject = useUpdateProject();
  const cancelProject = useCancelProject();

  const [titleEdit, setTitleEdit] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (project) setTitleEdit(project.title);
  }, [project?.id, project?.title]);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!project || !id) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Projeto não encontrado.</p>
      </div>
    );
  }

  const isOwner = project.owner_id === user?.id;
  const status = stats?.status ?? "planning";
  const pct = stats?.completion_pct ?? 0;
  const total = stats?.total_demands ?? 0;
  const completed = stats?.completed ?? 0;
  const totalHours = stats?.total_hours ?? 0;

  const handleTitleSave = async () => {
    const t = titleEdit.trim();
    setEditing(false);
    if (!t || t === project.title) return;
    await updateProject.mutateAsync({ id, fields: { title: t } });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-3 w-3" />
          Projetos
        </button>

        {editing && isOwner ? (
          <Input
            value={titleEdit}
            onChange={(e) => setTitleEdit(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitleEdit(project.title);
                setEditing(false);
              }
            }}
            autoFocus
            className="text-2xl font-semibold h-auto py-1 mb-2"
          />
        ) : (
          <h1
            className={cn(
              "text-2xl font-semibold mb-2",
              isOwner && "cursor-text hover:text-primary transition-colors",
            )}
            onClick={() => isOwner && setEditing(true)}
          >
            {project.title}
          </h1>
        )}

        <div className="flex items-center gap-2 flex-wrap text-sm">
          <StatusBadge status={status} />
          {project.clients && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {project.clients.name}
            </span>
          )}
          {project.user_profiles && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {project.user_profiles.full_name || project.user_profiles.email}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>
              {completed}/{total} demandas concluídas
            </span>
            <span className="font-medium">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct === 100
                  ? "bg-emerald-500"
                  : pct > 50
                  ? "bg-primary"
                  : "bg-primary/60",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="demands">
            <TabsList>
              <TabsTrigger value="demands">Demandas</TabsTrigger>
              <TabsTrigger value="squad">Squad</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>
            <TabsContent value="demands" className="mt-4">
              <ProjectDemandsTab projectId={id} />
            </TabsContent>
            <TabsContent value="squad" className="mt-4">
              <ProjectSquadTab
                projectId={id}
                ownerId={project.owner_id}
                isOwner={isOwner}
              />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <ProjectActivityTab projectId={id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-[280px] lg:shrink-0 space-y-4">
          <section className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Detalhes
            </p>
            <SidebarRow
              label="Owner"
              value={
                project.user_profiles?.full_name ||
                project.user_profiles?.email ||
                "—"
              }
            />
            <SidebarRow
              label="Cliente"
              value={project.clients?.name ?? "—"}
            />
            <SidebarRow
              label="Data de entrega"
              value={
                project.due_date
                  ? format(new Date(project.due_date), "dd MMM yyyy", {
                      locale: ptBR,
                    })
                  : "—"
              }
              icon={CalendarDays}
            />
            <SidebarRow
              label="Criado em"
              value={format(new Date(project.created_at), "dd MMM yyyy", {
                locale: ptBR,
              })}
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Tempo total
            </p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-lg font-semibold">
                {totalHours.toFixed(1)}h
              </span>
            </div>
          </section>

          {isOwner && !project.cancelled_at && (
            <section className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                Ações
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancelar projeto
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar projeto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação cancelará o projeto e todas as demandas ativas
                      vinculadas. Demandas já concluídas serão preservadas.
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => cancelProject.mutate({ id })}
                    >
                      Sim, cancelar projeto
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

interface SidebarRowProps {
  label: string;
  value: string;
  icon?: LucideIcon;
}

function SidebarRow({ label, value, icon: Icon }: SidebarRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xs font-medium flex items-center gap-1 truncate max-w-[60%] text-right">
        {Icon && <Icon className="h-3 w-3 shrink-0" />}
        {value}
      </span>
    </div>
  );
}
