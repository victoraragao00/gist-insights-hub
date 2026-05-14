import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { formatHours } from "@/lib/formatHours";
import {
  useTask,
  useTaskTimeEntries,
  useUpdateDemandTask,
  type DemandTaskStatus,
} from "@/hooks/useDemandTasks";
import { useTaskTotalHours, useDeleteTimeEntry } from "@/hooks/useDemandTimeEntries";
import { DemandTimeTrackingSection } from "@/components/demands/DemandTimeTrackingSection";
import { TimeEntryRow } from "@/components/demands/detail/TimeEntryRow";
import { useAuth } from "@/context/AuthContext";

interface UserProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

const STATUS_OPTIONS: Array<{ value: DemandTaskStatus; label: string; icon: string; cls: string }> = [
  { value: "open", label: "Aberto", icon: "○", cls: "text-muted-foreground" },
  { value: "in_progress", label: "Em andamento", icon: "◑", cls: "text-blue-600 dark:text-blue-400" },
  { value: "done", label: "Concluído", icon: "●", cls: "text-emerald-600 dark:text-emerald-400" },
];

function StatusSelect({
  value,
  onChange,
}: {
  value: DemandTaskStatus;
  onChange: (v: DemandTaskStatus) => void;
}) {
  const current = STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DemandTaskStatus)}>
      <SelectTrigger className="h-7 w-auto gap-1.5 text-sm font-medium border-0 p-0 bg-transparent focus:ring-0">
        <span className={current.cls}>{current.icon}</span>
        <span>{current.label}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className={cn("flex items-center gap-2", o.cls)}>
              <span>{o.icon}</span> {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AssigneeCompact({
  value,
  users,
  onChange,
}: {
  value: string | null;
  users: UserProfileMini[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = users.find((u) => u.id === value);
  const label = current?.full_name ?? current?.email ?? "Sem responsável";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-sm font-medium hover:text-primary transition-colors text-right truncate max-w-[180px]"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="end">
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

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: task, isLoading, isError } = useTask(id);
  const { data: timeEntries = [] } = useTaskTimeEntries(id);
  const { data: actualHours = 0 } = useTaskTotalHours(id);
  const updateTask = useUpdateDemandTask();
  const deleteEntry = useDeleteTimeEntry();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-medium">Subdemanda não encontrada</p>
        <Button variant="link" onClick={() => navigate("/demands")} className="mt-2">
          Voltar
        </Button>
      </div>
    );
  }

  const status = (task.status ?? "open") as DemandTaskStatus;
  const update = (fields: Partial<{
    title: string;
    description: string | null;
    assignee_id: string | null;
    hours_estimated: number | null;
    status: DemandTaskStatus;
  }>) => updateTask.mutate({ id: task.id, demand_id: task.demand_id, ...fields });

  const estimated = task.hours_estimated ? Number(task.hours_estimated) : null;
  const overrun = estimated != null && actualHours > estimated;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <button
            onClick={() => navigate(`/demands/${task.demand_id}`)}
            className="hover:text-foreground transition-colors"
          >
            ← {task.demands?.title ?? "Demanda"}
          </button>
          <span>/</span>
          <span>Subdemandas</span>
        </div>

        <input
          type="text"
          defaultValue={task.title}
          key={`t-${task.id}-${task.title}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== task.title) update({ title: v });
          }}
          className="w-full text-xl font-semibold bg-transparent border-0 p-0 focus:outline-none focus:ring-0 mb-3"
        />

        <div className="flex items-center gap-2 flex-wrap">
          <StatusSelect value={status} onChange={(v) => update({ status: v })} />
          {task.demands?.clients?.name && (
            <Badge variant="outline" className="gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              {task.demands.clients.name}
            </Badge>
          )}
          {task.demands?.ticket_columns?.name && (
            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900">
              {task.demands.ticket_columns.name}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <main className="flex-1 min-w-0 space-y-6">
          {/* Description */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Descrição
            </h3>
            <textarea
              defaultValue={task.description ?? ""}
              key={`d-${task.id}-${task.description ?? ""}`}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (task.description ?? null)) update({ description: v });
              }}
              placeholder="Adicionar descrição..."
              rows={4}
              className="w-full bg-transparent text-sm border border-border rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </section>

          {/* Time history */}
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Histórico de horas
            </h3>
            {timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma hora registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {timeEntries.map((entry) => (
                  <TimeEntryRow
                    key={entry.id}
                    entry={entry}
                    currentUserId={user?.id}
                    onDelete={(entryId) => deleteEntry.mutate({ entryId })}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="w-full lg:w-[280px] lg:shrink-0 space-y-4">
          {/* Detalhes */}
          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground pb-3">
              Detalhes
            </p>
            <div className="divide-y divide-border/50">
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground text-xs">Responsável</span>
                <AssigneeCompact
                  value={task.assignee_id}
                  users={userProfiles}
                  onChange={(v) => update({ assignee_id: v })}
                />
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground text-xs">Criado por</span>
                <span className="font-medium text-right text-sm">
                  {task.creator?.full_name ?? task.creator?.email ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground text-xs">Criado em</span>
                <span className="font-medium text-right text-sm">
                  {format(new Date(task.created_at), "dd MMM yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground text-xs">Início</span>
                <span className="font-medium text-right text-sm">
                  {task.started_at ? (
                    format(new Date(task.started_at), "dd MMM yyyy HH:mm", { locale: ptBR })
                  ) : (
                    <span className="text-muted-foreground/60 italic">Não iniciado</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground text-xs">Conclusão</span>
                <span className="font-medium text-right text-sm">
                  {task.finished_at ? (
                    format(new Date(task.finished_at), "dd MMM yyyy HH:mm", { locale: ptBR })
                  ) : (
                    <span className="text-muted-foreground/60 italic">Em aberto</span>
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* Horas */}
          <section className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Horas
            </p>
            <div className="flex justify-between text-sm mb-2 items-center">
              <span className="text-muted-foreground">Estimadas</span>
              <input
                type="number"
                step="0.5"
                min="0"
                defaultValue={task.hours_estimated ?? ""}
                key={`he-${task.id}-${task.hours_estimated ?? ""}`}
                onBlur={(e) => {
                  const raw = e.target.value;
                  const next = raw === "" ? null : parseFloat(raw);
                  const nextVal = Number.isFinite(next as number) ? (next as number) : null;
                  if (nextVal !== task.hours_estimated) update({ hours_estimated: nextVal });
                }}
                placeholder="—"
                className="w-16 text-right bg-transparent border-0 p-0 text-sm font-medium focus:outline-none focus:ring-0"
              />
            </div>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-muted-foreground">Registradas</span>
              <span className="font-semibold">{formatHours(actualHours)}</span>
            </div>
            {estimated != null && estimated > 0 && (
              <div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      overrun ? "bg-orange-500" : "bg-primary",
                    )}
                    style={{ width: `${Math.min((actualHours / estimated) * 100, 100)}%` }}
                  />
                </div>
                {overrun && (
                  <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-1">
                    +{formatHours(actualHours - estimated)} acima do estimado
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Timer */}
          <section className="rounded-lg border border-border bg-card p-4">
            <DemandTimeTrackingSection demandId={task.demand_id} taskId={task.id} compact />
          </section>
        </aside>
      </div>
      </div>
    </div>
  );
}
