import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface UserProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

const NEXT_STATUS: Record<DemandTaskStatus, DemandTaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

const STATUS_CHIP: Record<DemandTaskStatus, { label: string; chip: string }> = {
  open: {
    label: "Aberto",
    chip: "bg-muted/60 text-muted-foreground border-border/60",
  },
  in_progress: {
    label: "Em andamento",
    chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  },
  done: {
    label: "Concluído",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
};

function getInitials(label?: string | null) {
  if (!label) return "?";
  return label.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function StatusIcon({ status }: { status: DemandTaskStatus }) {
  if (status === "done") {
    return (
      <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-emerald-500 bg-emerald-500 flex items-center justify-center">
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
      </div>
    );
  }
  if (status === "in_progress") {
    return (
      <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-blue-400 bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
      </div>
    );
  }
  return (
    <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-border hover:border-primary hover:bg-primary/10 transition-colors" />
  );
}

interface Props {
  demandId: string;
}

export function DemandTasksSection({ demandId }: Props) {
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

  const [confirmDelete, setConfirmDelete] = useState<DemandTaskRow | null>(null);

  const total = stats?.total ?? tasks.length;
  const done = stats?.done ?? tasks.filter((t) => t.status === "done").length;
  const inProgress =
    stats?.in_progress ?? tasks.filter((t) => t.status === "in_progress").length;
  const completionPct =
    stats?.completion_pct ?? (total > 0 ? Math.round((done / total) * 100) : 0);
  const hoursEstSum = stats?.hours_estimated_sum ?? 0;

  const { hoursActualDone, hoursActualInProgress, totalActualHours } = useMemo(() => {
    let dDone = 0, dProg = 0, dAll = 0;
    for (const t of tasks) {
      const v = Number(t.hours_actual ?? 0);
      if (!v) continue;
      dAll += v;
      if (t.status === "done") dDone += v;
      else if (t.status === "in_progress") dProg += v;
    }
    return { hoursActualDone: dDone, hoursActualInProgress: dProg, totalActualHours: dAll };
  }, [tasks]);

  const summaryCards = [
    {
      key: "total",
      num: total,
      label: "Total",
      sub: hoursEstSum > 0 ? `${formatHours(hoursEstSum)} estimadas` : null,
      color: "text-primary",
    },
    {
      key: "in_progress",
      num: inProgress,
      label: "Em andamento",
      sub: hoursActualInProgress > 0 ? `${formatHours(hoursActualInProgress)} real` : null,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      key: "done",
      num: done,
      label: "Concluídas",
      sub: hoursActualDone > 0 ? `${formatHours(hoursActualDone)} real` : null,
      color: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className="border border-border rounded-xl p-3 text-center bg-card"
          >
            <div className={cn("text-2xl font-semibold", card.color)}>{card.num}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
            {card.sub && (
              <div className="text-[11px] text-muted-foreground/60 mt-1">{card.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 flex-wrap gap-2">
            <span>
              <span className="font-medium text-foreground">{done}</span>
              /{total} concluídas <span className="text-muted-foreground/70">· {completionPct}%</span>
            </span>
            <div className="flex items-center gap-3">
              {hoursEstSum > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatHours(hoursEstSum)} estimadas
                </span>
              )}
              {totalActualHours > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3" /> {formatHours(totalActualHours)} reais
                </span>
              )}
            </div>
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

      {/* Tasks list */}
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <DemandTaskItem
            key={task.id}
            task={task}
            userProfiles={userProfiles}
            onUpdate={(fields) =>
              updateMutation.mutate({ id: task.id, demand_id: demandId, ...fields })
            }
            onDelete={() => setConfirmDelete(task)}
          />
        ))}

        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
            Nenhuma subdemanda. Quebre essa demanda em passos menores.
          </p>
        )}

        <AddTaskInline
          userProfiles={userProfiles}
          onAdd={(input) =>
            createMutation.mutate({
              demand_id: demandId,
              title: input.title,
              assignee_id: input.assignee_id,
              hours_estimated: input.hours_estimated,
              position: tasks.length,
            })
          }
        />
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

interface ItemUpdate {
  title?: string;
  assignee_id?: string | null;
  hours_estimated?: number | null;
  hours_actual?: number | null;
  status?: DemandTaskStatus;
}

interface DemandTaskItemProps {
  task: DemandTaskRow;
  userProfiles: UserProfileMini[];
  onUpdate: (fields: ItemUpdate) => void;
  onDelete: () => void;
}

function DemandTaskItem({ task, userProfiles, onUpdate, onDelete }: DemandTaskItemProps) {
  const status = (task.status ?? "open") as DemandTaskStatus;
  const cfg = STATUS_CHIP[status];
  const assignee = userProfiles.find((u) => u.id === task.assignee_id);
  const assigneeLabel = assignee?.full_name ?? assignee?.email ?? null;

  return (
    <div
      className={cn(
        "group border border-border rounded-xl px-3 py-2.5 transition-all bg-card",
        "hover:border-primary/30 hover:shadow-sm",
        status === "done" && "opacity-60 bg-muted/20",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          type="button"
          onClick={() => onUpdate({ status: NEXT_STATUS[status] })}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110"
          title={`Marcar como ${STATUS_CHIP[NEXT_STATUS[status]].label}`}
          aria-label={`Status: ${cfg.label}`}
        >
          <StatusIcon status={status} />
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            defaultValue={task.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.title) onUpdate({ title: v });
              else if (!v) e.target.value = task.title;
            }}
            className={cn(
              "w-full bg-transparent text-sm font-medium border-0 p-0",
              "focus:outline-none focus:ring-0",
              status === "done" && "line-through text-muted-foreground",
            )}
          />

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Assignee */}
            <select
              value={task.assignee_id ?? ""}
              onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 text-muted-foreground focus:outline-none"
            >
              <option value="">Sem responsável</option>
              {userProfiles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>

            {assigneeLabel && (
              <div
                className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold flex items-center justify-center"
                title={assigneeLabel}
              >
                {getInitials(assigneeLabel)}
              </div>
            )}

            {/* Hours est / real */}
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <input
                type="number"
                step="0.5"
                min="0"
                defaultValue={task.hours_estimated ?? ""}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : parseFloat(e.target.value);
                  if (v !== Number(task.hours_estimated ?? null)) {
                    onUpdate({ hours_estimated: Number.isFinite(v as number) ? v : null });
                  }
                }}
                placeholder="0"
                className="w-8 bg-transparent border-0 p-0 text-xs focus:outline-none"
              />
              <span className="text-muted-foreground/60">est</span>

              {status !== "open" && (
                <>
                  <span className="text-muted-foreground/30 mx-0.5">/</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={task.hours_actual ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value === "" ? null : parseFloat(e.target.value);
                      if (v !== Number(task.hours_actual ?? null)) {
                        onUpdate({ hours_actual: Number.isFinite(v as number) ? v : null });
                      }
                    }}
                    placeholder="0"
                    className="w-8 bg-transparent border-0 p-0 text-xs focus:outline-none"
                  />
                  <span className="text-muted-foreground/60">real</span>
                </>
              )}
            </div>

            {/* Status chip */}
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full border font-medium",
                cfg.chip,
              )}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Delete on hover */}
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded shrink-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label="Excluir subdemanda"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Add inline ──

interface AddInput {
  title: string;
  assignee_id: string | null;
  hours_estimated: number | null;
}

interface AddTaskInlineProps {
  userProfiles: UserProfileMini[];
  onAdd: (input: AddInput) => void;
}

function AddTaskInline({ userProfiles, onAdd }: AddTaskInlineProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [hoursEst, setHoursEst] = useState("");

  const reset = () => {
    setTitle("");
    setAssigneeId(null);
    setHoursEst("");
    setOpen(false);
  };

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      assignee_id: assigneeId,
      hours_estimated: hoursEst === "" ? null : parseFloat(hoursEst) || null,
    });
    reset();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-1 mt-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar subdemanda
      </button>
    );
  }

  return (
    <div className="border border-primary/50 rounded-xl p-3 mt-1 bg-card">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) submit();
          if (e.key === "Escape") reset();
        }}
        placeholder="Título da subdemanda..."
        className="w-full bg-transparent text-sm font-medium border-0 p-0 focus:outline-none focus:ring-0 mb-3"
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            className="text-xs px-2 py-1 rounded-md border border-border bg-background text-muted-foreground"
          >
            <option value="">Sem responsável</option>
            {userProfiles.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1 rounded-md border border-border bg-background">
            <Clock className="h-3 w-3" />
            <input
              type="number"
              step="0.5"
              min="0"
              value={hoursEst}
              onChange={(e) => setHoursEst(e.target.value)}
              placeholder="0h est"
              className="w-14 bg-transparent border-0 p-0 text-xs focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <Button size="sm" disabled={!title.trim()} onClick={submit} className="h-7 text-xs">
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
