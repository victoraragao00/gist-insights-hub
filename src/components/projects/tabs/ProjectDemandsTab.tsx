import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, X } from "lucide-react";
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
} from "@/hooks/useProjects";
import { LinkDemandDialog } from "../LinkDemandDialog";
import {
  priorityBadgeClass,
  priorityLabel,
} from "@/components/demands/detail/priorityBadgeStyles";
import type { DemandPriority } from "@/hooks/useDemands";

interface ProjectDemandsTabProps {
  projectId: string;
}

export function ProjectDemandsTab({ projectId }: ProjectDemandsTabProps) {
  const navigate = useNavigate();
  const { data: demands = [] } = useProjectDemands(projectId);
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
                </div>
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
        projectId={projectId}
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
