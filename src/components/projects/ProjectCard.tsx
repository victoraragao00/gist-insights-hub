import { useNavigate } from "react-router-dom";
import { Building2, CalendarDays, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/projectStatus";
import { StatusBadge } from "./StatusBadge";
import { MemberAvatar } from "./MemberAvatar";
import {
  useProjectStats,
  useProjectMembers,
  type ProjectRow,
} from "@/hooks/useProjects";

interface ProjectCardProps {
  project: ProjectRow;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const { data: stats } = useProjectStats(project.id);
  const { data: members = [] } = useProjectMembers(project.id);

  const status = stats?.status ?? "planning";
  const total = stats?.total_demands ?? 0;
  const completed = stats?.completed ?? 0;
  const pct = stats?.completion_pct ?? 0;
  const overdueCount = stats?.overdue_count ?? 0;

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="border border-border rounded-2xl p-4 bg-card hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-sm leading-snug line-clamp-2">
          {project.title}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {!project.client_id && project.workspace === "tech" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900 font-medium">
              Interno
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {project.clients && project.client_id && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {project.clients.name}
        </p>
      )}

      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            {completed}/{total} demandas
          </span>
          <span className="font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {members.slice(0, 4).map((m) => (
            <MemberAvatar key={m.user_id} user={m.user_profiles} size="sm" />
          ))}
          {members.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground">
              +{members.length - 4}
            </div>
          )}
        </div>

        {project.due_date && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              isOverdue(project.due_date)
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {isOverdue(project.due_date) && (
              <AlertTriangle className="h-3 w-3" />
            )}
            <CalendarDays className="h-3 w-3" />
            {format(new Date(project.due_date), "dd MMM", { locale: ptBR })}
          </div>
        )}
      </div>

      {overdueCount > 0 && (
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-3 w-3" />
          {overdueCount} demanda{overdueCount > 1 ? "s" : ""} ultrapassando o
          prazo
        </div>
      )}
    </div>
  );
}
