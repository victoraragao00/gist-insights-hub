import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Plus, Trash2, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatHours } from "@/lib/formatHours";
import {
  useDemandTasks,
  useDemandTaskStats,
  useCreateDemandTask,
  useUpdateDemandTask,
  useDeleteDemandTask,
  type DemandTaskRow,
  type DemandTaskStatus,
} from "@/hooks/useDemandTasks";
import { useTaskTotalHours } from "@/hooks/useDemandTimeEntries";

interface UserProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

const STATUS_CONFIG: Record<
  DemandTaskStatus,
  { label: string; className: string; dot: string }
> = {
  open: {
    label: "Aberto",
    className: "text-muted-foreground",
    dot: "border border-muted-foreground/50 bg-transparent",
  },
  in_progress: {
    label: "Em andamento",
    className: "text-blue-600 dark:text-blue-400",
    dot: "border-2 border-blue-500 bg-blue-500/30",
  },
  done: {
    label: "Concluído",
    className: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500 border border-emerald-500",
  },
};

const NEXT_STATUS: Record<DemandTaskStatus, DemandTaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

interface DemandTasksSectionProps {
  demandId: string;
}

export function DemandTasksSection({ demandId }: DemandTasksSectionProps) {
  const { data: tasks = [] } = useDemandTasks(demandId);
  const { data: stats } = useDemandTaskStats(demandId);
  const { data: userProfiles = [] } = useQuery<UserProfileMini[]>({
    queryKey: ["user_profiles_active"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserProfileMini[];
    },
  });

  const createMutation = useCreateDemandTask();
  const updateMutation = useUpdateDemandTask();
  const deleteMutation = useDeleteDemandTask();

  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DemandTaskRow | null>(null);

  const total = stats?.total ?? tasks.length;
  const done = stats?.done ?? tasks.filter((t) => t.status === "done").length;
  const completionPct =
    stats?.completion_pct ??
    (total > 0 ? Math.round((done / total) * 1000) / 10 : 0);
  const hoursEstimatedSum = stats?.hours_estimated_sum ?? 0;

  const handleAdd = (title: string) => {
    if (!title.trim()) return;
    createMutation.mutate(
      {
        demand_id: demandId,
        title: title.trim(),
        position: tasks.length,
      },
      { onSuccess: () => setAdding(false) },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Subdemandas</Label>
        {!adding && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        )}
      </div>

      {total > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              <span className="font-medium text-foreground">{done}</span>/{total} concluídas
              {completionPct > 0 && (
                <span className="ml-1.5 text-muted-foreground/70">· {completionPct}%</span>
              )}
            </span>
            {hoursEstimatedSum > 0 && (
              <span>{formatHours(hoursEstimatedSum)} estimadas</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                completionPct >= 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${Math.min(100, completionPct)}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {tasks.map((task) => (
          <DemandTaskItem
            key={task.id}
            task={task}
            demandId={demandId}
            userProfiles={userProfiles}
            onUpdate={(fields) =>
              updateMutation.mutate({ id: task.id, demand_id: demandId, ...fields })
            }
            onDelete={() => setConfirmDelete(task)}
          />
        ))}

        {tasks.length === 0 && !adding && (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
            Nenhuma subdemanda. Quebre essa demanda em passos menores.
          </p>
        )}

        {adding && <AddTaskInline onAdd={handleAdd} onCancel={() => setAdding(false)} />}
      </div>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir subdemanda?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  deleteMutation.mutate({ id: confirmDelete.id, demand_id: demandId });
                }
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Task item ──

interface DemandTaskItemProps {
  task: DemandTaskRow;
  demandId: string;
  userProfiles: UserProfileMini[];
  onUpdate: (fields: Partial<{
    title: string;
    description: string | null;
    assignee_id: string | null;
    hours_estimated: number | null;
    hours_actual: number | null;
    status: DemandTaskStatus;
  }>) => void;
  onDelete: () => void;
}

const STATUS_CHIP: Record<DemandTaskStatus, string> = {
  open: "bg-muted/60 text-muted-foreground border-border/60",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
};

function getInitials(label?: string | null) {
  if (!label) return "?";
  return label.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function DemandTaskItem({ task, userProfiles, onUpdate, onDelete }: DemandTaskItemProps) {
  const navigate = useNavigate();
  const status = (task.status ?? "open") as DemandTaskStatus;
  const cfg = STATUS_CONFIG[status];
  const { data: taskHours = 0 } = useTaskTotalHours(task.id);

  const assignee = userProfiles.find((u) => u.id === task.assignee_id);
  const assigneeLabel = assignee?.full_name ?? assignee?.email ?? null;

  return (
    <div
      className={cn(
        "group border border-border rounded-lg transition-all bg-card cursor-pointer",
        "hover:border-primary/30 hover:shadow-sm",
        status === "done" && "opacity-60 bg-muted/20",
      )}
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ status: NEXT_STATUS[status] });
          }}
          className={cn(
            "h-4 w-4 rounded-full shrink-0 transition-transform hover:scale-110 flex items-center justify-center",
            cfg.dot,
          )}
          title={cfg.label}
          aria-label={`Status: ${cfg.label}`}
        >
          {status === "done" && <Check className="h-2.5 w-2.5 text-white" />}
        </button>

        <span
          className={cn(
            "flex-1 text-sm font-medium truncate",
            status === "done" && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {assigneeLabel && (
            <div
              className="w-5 h-5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[9px] font-semibold flex items-center justify-center"
              title={assigneeLabel}
            >
              {getInitials(assigneeLabel)}
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.hours_estimated ? (
              <span>{formatHours(Number(task.hours_estimated))} est</span>
            ) : (
              <span className="text-muted-foreground/40">—</span>
            )}
            {taskHours > 0 && (
              <>
                <span className="text-muted-foreground/30">/</span>
                <span className="font-medium text-foreground">{formatHours(taskHours)}</span>
              </>
            )}
          </div>

          <span className={cn("text-[11px] px-1.5 py-0.5 rounded border font-medium", STATUS_CHIP[status])}>
            {cfg.label}
          </span>

          {task.started_at && !task.finished_at && (
            <span className="text-[11px] text-blue-600 dark:text-blue-400 hidden sm:inline">
              desde {format(new Date(task.started_at), "dd/MM", { locale: ptBR })}
            </span>
          )}
          {task.finished_at && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 hidden sm:inline">
              ✓ {format(new Date(task.finished_at), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded shrink-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
          aria-label="Excluir subdemanda"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}


// ── Add inline ──

interface AddTaskInlineProps {
  onAdd: (title: string) => void;
  onCancel: () => void;
}

function AddTaskInline({ onAdd, onCancel }: AddTaskInlineProps) {
  const [title, setTitle] = useState("");

  return (
    <div className="border border-primary/40 rounded-md p-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            onAdd(title.trim());
            setTitle("");
          }
          if (e.key === "Escape") {
            setTitle("");
            onCancel();
          }
        }}
        placeholder="Título da subdemanda... (Enter para salvar, Esc para cancelar)"
        className="w-full bg-transparent text-sm border-0 p-0 focus:outline-none focus:ring-0"
      />
      <div className="flex gap-2 mt-2">
        <Button
          size="sm"
          onClick={() => {
            if (title.trim()) {
              onAdd(title.trim());
              setTitle("");
            }
          }}
        >
          Salvar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTitle("");
            onCancel();
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
