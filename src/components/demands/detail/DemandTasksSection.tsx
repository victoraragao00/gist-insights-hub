import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Plus, Trash2, Check, Circle, CircleDot, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
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

const STATUS_CONFIG: Record<DemandTaskStatus, {
  label: string;
  Icon: typeof Circle;
  trigger: string;
  dotColor: string;
}> = {
  open: {
    label: "Aberto",
    Icon: Circle,
    trigger: "bg-muted/60 text-muted-foreground border-border",
    dotColor: "#888780",
  },
  in_progress: {
    label: "Em andamento",
    Icon: CircleDot,
    trigger: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    dotColor: "#378ADD",
  },
  done: {
    label: "Concluído",
    Icon: CheckCircle2,
    trigger: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    dotColor: "#1D9E75",
  },
};

const TASK_BG: Record<DemandTaskStatus, string> = {
  open: "bg-card",
  in_progress: "bg-blue-50/30 dark:bg-blue-950/10",
  done: "bg-muted/20",
};

function TaskStatusSelect({
  value,
  onChange,
}: {
  value: DemandTaskStatus;
  onChange: (v: DemandTaskStatus) => void;
}) {
  const current = STATUS_CONFIG[value];
  const CurrentIcon = current.Icon;
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DemandTaskStatus)}>
      <SelectTrigger
        className={cn(
          "h-7 w-auto gap-1.5 text-xs font-medium border rounded-full px-2.5",
          "focus:ring-0 focus:ring-offset-0 [&>svg:last-child]:hidden",
          current.trigger,
        )}
      >
        <CurrentIcon className="h-3.5 w-3.5" />
        <span>{current.label}</span>
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(STATUS_CONFIG) as Array<[DemandTaskStatus, typeof STATUS_CONFIG[DemandTaskStatus]]>).map(
          ([key, cfg]) => {
            const Icon = cfg.Icon;
            const selected = key === value;
            return (
              <SelectItem key={key} value={key}>
                <div className={cn("flex items-center gap-2 rounded-md px-1 py-0.5", selected && cfg.trigger)}>
                  <Icon className="h-3.5 w-3.5" style={{ color: cfg.dotColor }} />
                  <span className="text-xs font-medium">{cfg.label}</span>
                </div>
              </SelectItem>
            );
          },
        )}
      </SelectContent>
    </Select>
  );
}

function HoursField({
  label,
  value,
  onSave,
  readOnly = false,
}: {
  label: "Planejado" | "Realizado";
  value: number | null | undefined;
  onSave: (val: number | null) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const formatted = value && value > 0 ? `${value}h` : null;

  const commit = () => {
    const parsed = draft === "" ? null : parseFloat(draft);
    onSave(Number.isFinite(parsed as number) ? (parsed as number) : null);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] text-muted-foreground/60">{label}</span>
        <input
          autoFocus
          type="number"
          step="0.5"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-12 h-5 text-xs border border-primary/40 rounded px-1 bg-background focus:outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value != null ? String(value) : "");
        setEditing(true);
      }}
      disabled={readOnly}
      className={cn(
        "flex items-center gap-1 text-xs transition-colors",
        formatted
          ? label === "Planejado"
            ? "text-muted-foreground"
            : "text-foreground font-medium"
          : "text-muted-foreground/40",
        !readOnly && "hover:text-primary",
      )}
      title={`${label}: clique para editar`}
    >
      <span className="text-[10px] text-muted-foreground/50">{label}</span>
      <span>{formatted ?? "—"}</span>
    </button>
  );
}

function DemandTaskItem({ task, userProfiles, onUpdate, onDelete }: DemandTaskItemProps) {
  const navigate = useNavigate();
  const status = (task.status ?? "open") as DemandTaskStatus;
  const goToTask = () => navigate(`/tasks/${task.id}`);

  return (
    <div
      className={cn(
        "group border border-border rounded-xl transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        TASK_BG[status],
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <TaskStatusSelect
            value={status}
            onChange={(v) => onUpdate({ status: v })}
          />
        </div>

        <span
          onClick={goToTask}
          className={cn(
            "flex-1 min-w-0 truncate text-sm font-medium cursor-pointer hover:text-primary transition-colors",
            status === "done" && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </span>

        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <select
            value={task.assignee_id ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate({ assignee_id: e.target.value || null })}
            className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/40 text-muted-foreground focus:outline-none max-w-[140px]"
          >
            <option value="">Sem responsável</option>
            {userProfiles.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <HoursField
              label="Planejado"
              value={task.hours_estimated}
              onSave={(val) => onUpdate({ hours_estimated: val })}
            />
            <span className="text-muted-foreground/30">/</span>
            <HoursField
              label="Realizado"
              value={task.hours_actual}
              onSave={(val) => onUpdate({ hours_actual: val })}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goToTask(); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Abrir subdemanda"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            aria-label="Excluir subdemanda"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
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
