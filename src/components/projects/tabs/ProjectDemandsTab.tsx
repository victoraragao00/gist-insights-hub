import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useProjectDemands,
  useUnlinkDemandFromProject,
  type ProjectRow,
} from "@/hooks/useProjects";
import { LinkDemandDialog } from "../LinkDemandDialog";
import {
  priorityBadgeClass,
  priorityLabel,
} from "@/components/demands/detail/priorityBadgeStyles";
import type { DemandPriority } from "@/hooks/useDemands";
import { useDemandTaskCounts } from "@/hooks/useDemandTasks";

interface ProjectDemandsTabProps {
  project: ProjectRow;
}

export function ProjectDemandsTab({ project }: ProjectDemandsTabProps) {
  const projectId = project.id;
  const navigate = useNavigate();
  const { data: demands = [] } = useProjectDemands(projectId);
  const demandIds = demands.map((d) => d.id);
  const { data: taskCounts = {} } = useDemandTaskCounts(demandIds);
  const unlink = useUnlinkDemandFromProject();
  const [showLink, setShowLink] = useState(false);
  const [unlinkId, setUnlinkId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          {demands.length} demanda{demands.length !== 1 ? "s" : ""}
        </span>
        <Button size="sm" variant="outline" onClick={() => setShowLink(true)}>
          <Link2 className="h-3.5 w-3.5 mr-1.5" /> Adicionar demanda
        </Button>
      </div>

      {demands.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-xl">
          Nenhuma demanda vinculada ainda.
        </p>
      ) : (
        <div className="border border-border rounded-xl bg-card divide-y divide-border/50">
          {demands.map((d) => (
            <div
              key={d.id}
              className="group flex items-center gap-3 px-3 py-2.5"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: d.ticket_columns?.color ?? "hsl(var(--muted))",
                }}
                title={d.ticket_columns?.name ?? ""}
              />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/demands/${d.id}`)}
                  className="text-sm font-medium hover:text-primary truncate block text-left w-full"
                >
                  {d.title}
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  {d.demand_types && (
                    <span className="text-xs text-muted-foreground">
                      {d.demand_types.name}
                    </span>
                  )}
                  {d.user_profiles && (
                    <span className="text-xs text-muted-foreground">
                      ·{" "}
                      {d.user_profiles.full_name || d.user_profiles.email}
                    </span>
                  )}
                  {d.ticket_columns && (
                    <span className="text-xs text-muted-foreground">
                      · {d.ticket_columns.name}
                    </span>
                  )}
                  {!project.is_internal &&
                    project.client_id &&
                    d.client_id &&
                    d.client_id !== project.client_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 font-medium">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Cliente diferente
                      </span>
                    )}
                </div>
                {taskCounts[d.id] && taskCounts[d.id].total > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${taskCounts[d.id].completion_pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {taskCounts[d.id].done}/{taskCounts[d.id].total}
                    </span>
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                  priorityBadgeClass(d.priority as DemandPriority),
                )}
              >
                {priorityLabel(d.priority as DemandPriority)}
              </span>
              <button
                onClick={() => setUnlinkId(d.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                aria-label="Desvincular"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <LinkDemandDialog
        project={project}
        open={showLink}
        onOpenChange={setShowLink}
      />

      <AlertDialog
        open={!!unlinkId}
        onOpenChange={(o) => !o && setUnlinkId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              A demanda permanecerá ativa, apenas será removida deste projeto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (unlinkId)
                  unlink.mutate({ demandId: unlinkId, projectId });
                setUnlinkId(null);
              }}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
