import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlignLeft, Clock, Plus, Trash2, Check, Play, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  useActiveTimerEntry,
  useUserActiveTimer,
  useStartTimer,
  useStopTimer,
  useAddManualEntry,
  useTaskTotalHours,
} from "@/hooks/useDemandTimeEntries";

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

function DemandTaskItem({ task, userProfiles, onUpdate, onDelete }: DemandTaskItemProps) {
  const [expanded, setExpanded] = useState(!!task.description);
  const status = (task.status ?? "open") as DemandTaskStatus;
  const cfg = STATUS_CONFIG[status];

  const assignee = userProfiles.find((u) => u.id === task.assignee_id);
  const assigneeLabel =
    assignee?.full_name ?? assignee?.email ?? null;

  return (
    <div
      className={cn(
        "group border border-border rounded-md p-3 transition-colors",
        status === "done" && "bg-muted/30 border-border/50",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          type="button"
          onClick={() => onUpdate({ status: NEXT_STATUS[status] })}
          className={cn(
            "h-4 w-4 rounded-full mt-1 shrink-0 transition-transform hover:scale-110 flex items-center justify-center",
            cfg.dot,
          )}
          title={cfg.label}
          aria-label={`Status: ${cfg.label}`}
        >
          {status === "done" && <Check className="h-2.5 w-2.5 text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            defaultValue={task.title}
            key={`title-${task.id}-${task.title}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== task.title) onUpdate({ title: v });
            }}
            className={cn(
              "w-full bg-transparent text-sm font-medium border-0 p-0 focus:outline-none focus:ring-0",
              status === "done" && "line-through text-muted-foreground",
            )}
          />

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {/* Assignee */}
            <AssigneePicker
              value={task.assignee_id}
              users={userProfiles}
              label={assigneeLabel}
              onChange={(v) => onUpdate({ assignee_id: v })}
            />

            {/* Hours estimated */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <input
                type="number"
                step="0.5"
                min="0"
                defaultValue={task.hours_estimated ?? ""}
                key={`he-${task.id}-${task.hours_estimated ?? ""}`}
                onBlur={(e) => {
                  const v = e.target.value === "" ? null : parseFloat(e.target.value);
                  const next = Number.isFinite(v as number) ? (v as number) : null;
                  if (next !== task.hours_estimated)
                    onUpdate({ hours_estimated: next });
                }}
                placeholder="0h est"
                className="w-14 bg-transparent border-0 p-0 text-xs focus:outline-none focus:ring-0"
              />
            </div>

            {/* Hours actual */}
            {status !== "open" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="text-muted-foreground/60">/</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  defaultValue={task.hours_actual ?? ""}
                  key={`ha-${task.id}-${task.hours_actual ?? ""}`}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : parseFloat(e.target.value);
                    const next = Number.isFinite(v as number) ? (v as number) : null;
                    if (next !== task.hours_actual)
                      onUpdate({ hours_actual: next });
                  }}
                  placeholder="0h real"
                  className="w-16 bg-transparent border-0 p-0 text-xs focus:outline-none focus:ring-0"
                />
              </div>
            )}

            <span className={cn("text-xs", cfg.className)}>{cfg.label}</span>
          </div>

          {(task.description || expanded) && (
            <div className="mt-2">
              <textarea
                defaultValue={task.description ?? ""}
                key={`desc-${task.id}-${task.description ?? ""}`}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (task.description ?? null))
                    onUpdate({ description: v });
                }}
                placeholder="Adicionar descrição..."
                rows={2}
                className="w-full bg-transparent text-xs text-muted-foreground border-0 p-0 resize-none focus:outline-none focus:ring-0"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Alternar descrição"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
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

// ── Assignee picker (compact) ──

interface AssigneePickerProps {
  value: string | null;
  users: UserProfileMini[];
  label: string | null;
  onChange: (id: string | null) => void;
}

function AssigneePicker({ value, users, label, onChange }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[140px]"
        >
          {label ?? "Sem responsável"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum usuário</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Sem responsável
              </CommandItem>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.full_name ?? u.email ?? u.id}
                  onSelect={() => {
                    onChange(u.id === value ? null : u.id);
                    setOpen(false);
                  }}
                >
                  {u.full_name ?? u.email}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
