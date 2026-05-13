import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateDemand, useTicketColumns, type DemandRow } from "@/hooks/useDemands";
import { useProject } from "@/hooks/useProjects";

type PlannedField = "planned_start_date" | "planned_end_date";

const PLANNED_LABELS: Record<PlannedField, string> = {
  planned_start_date: "Início previsto",
  planned_end_date: "Entrega prevista",
};

function toIso(d: Date | undefined): string | null {
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

function parseLocal(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  // value already datetime? Slice date part for safety.
  const dateOnly = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(dateOnly + "T00:00:00");
}

interface Props {
  demand: DemandRow;
}

export function DemandDatesSection({ demand }: Props) {
  const { data: project } = useProject(demand.project_id ?? undefined);
  const { data: columns = [] } = useTicketColumns();

  const projectLimit =
    (project as { planned_end_date?: string | null; due_date?: string | null } | null | undefined)
      ?.planned_end_date ??
    (project as { due_date?: string | null } | null | undefined)?.due_date ??
    null;

  const startedCol = columns.find((c) => c.id === demand.column_id && c.triggers_started_at);
  const finishedCol = columns.find((c) => c.id === demand.column_id && c.triggers_finished_at);

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Datas</p>

      <PlannedDateRow
        demand={demand}
        field="planned_start_date"
        projectLimit={null}
        otherDate={demand.planned_end_date ?? null}
        compareAs="start"
      />
      <PlannedDateRow
        demand={demand}
        field="planned_end_date"
        projectLimit={projectLimit}
        otherDate={demand.planned_start_date ?? null}
        compareAs="end"
      />

      <div className="border-t border-border pt-3 space-y-2">
        <ActualDateRow
          label="Início real"
          value={demand.started_at}
          hint={
            startedCol
              ? "automático"
              : "automático ao entrar em coluna de Em progresso"
          }
        />
        <ActualDateRow
          label="Conclusão real"
          value={demand.finished_at}
          hint={
            finishedCol
              ? "automático"
              : "automático ao entrar em coluna de Concluído"
          }
        />
      </div>

      {demand.project_id && projectLimit && (
        <p className="text-[11px] text-muted-foreground">
          Limite do projeto: {format(parseLocal(projectLimit)!, "dd/MM/yyyy", { locale: ptBR })}
        </p>
      )}
    </section>
  );
}

function PlannedDateRow({
  demand,
  field,
  projectLimit,
  otherDate,
  compareAs,
}: {
  demand: DemandRow;
  field: PlannedField;
  projectLimit: string | null;
  otherDate: string | null;
  compareAs: "start" | "end";
}) {
  const updateMutation = useUpdateDemand();
  const [open, setOpen] = useState(false);
  const value = (demand[field] as string | null) ?? null;
  const dateObj = parseLocal(value);
  const limitObj = parseLocal(projectLimit);
  const otherObj = parseLocal(otherDate);

  const handleSelect = (d: Date | undefined) => {
    setOpen(false);
    const newVal = toIso(d);
    if (newVal === value) return;

    if (d && otherObj) {
      if (compareAs === "start" && d > otherObj) {
        toast.error("Início previsto não pode ser depois da entrega prevista.");
        return;
      }
      if (compareAs === "end" && d < otherObj) {
        toast.error("Entrega prevista não pode ser antes do início previsto.");
        return;
      }
    }

    if (compareAs === "end" && d && limitObj && d > limitObj) {
      toast.error(
        `Entrega prevista não pode ser depois da data do projeto (${format(limitObj, "dd/MM/yyyy", { locale: ptBR })}).`,
      );
      return;
    }

    updateMutation.mutate({
      id: demand.id,
      fields: { [field]: newVal },
      fieldLabel: PLANNED_LABELS[field],
    });
  };

  const formatted = dateObj ? format(dateObj, "dd/MM/yyyy", { locale: ptBR }) : "—";

  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-xs text-muted-foreground">{PLANNED_LABELS[field]}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs font-medium gap-1.5",
              !value && "text-muted-foreground/60 italic",
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {formatted}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          {value && (
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => handleSelect(undefined)}
              >
                Limpar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ActualDateRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint: string;
}) {
  const formatted = value
    ? format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {formatted ? (
        <span className="text-xs font-medium">{formatted}</span>
      ) : (
        <span className="text-[11px] text-muted-foreground/70 italic" title={hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
