import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateProject, type ProjectRow } from "@/hooks/useProjects";

interface Props {
  project: ProjectRow;
  canEdit: boolean;
}

type DateField = "planned_start_date" | "planned_end_date" | "actual_start_date" | "actual_end_date";

const FIELD_LABELS: Record<DateField, string> = {
  planned_start_date: "Início previsto",
  planned_end_date: "Fim previsto",
  actual_start_date: "Início real",
  actual_end_date: "Fim real",
};

function toIso(d: Date | undefined): string | null {
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

export function ProjectDatesSection({ project, canEdit }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Datas
      </p>
      {(Object.keys(FIELD_LABELS) as DateField[]).map((f) => (
        <DateRow key={f} project={project} field={f} canEdit={canEdit} />
      ))}
    </section>
  );
}

function DateRow({ project, field, canEdit }: { project: ProjectRow; field: DateField; canEdit: boolean }) {
  const updateProject = useUpdateProject();
  const [open, setOpen] = useState(false);
  const value = project[field] as string | null;
  const dateObj = value ? new Date(value + "T00:00:00") : undefined;

  const handleSelect = async (d: Date | undefined) => {
    setOpen(false);
    const newVal = toIso(d);
    if (newVal === value) return;
    await updateProject.mutateAsync({ id: project.id, fields: { [field]: newVal } });
  };

  const formatted = dateObj ? format(dateObj, "dd/MM/yyyy", { locale: ptBR }) : "—";

  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground text-xs">{FIELD_LABELS[field]}</span>
      {canEdit ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-xs font-medium gap-1.5",
                !value && "text-muted-foreground/60 italic"
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
      ) : (
        <span className={cn("text-xs font-medium", !value && "text-muted-foreground/60 italic")}>
          {formatted}
        </span>
      )}
    </div>
  );
}
