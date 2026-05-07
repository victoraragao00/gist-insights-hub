import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/formatHours";
import { useProjectAgendas } from "@/hooks/useMeetingAgendas";

interface ProjectMeetingsTabProps {
  projectId: string;
}

export function ProjectMeetingsTab({ projectId }: ProjectMeetingsTabProps) {
  const navigate = useNavigate();
  const { data: agendas = [], isLoading } = useProjectAgendas(projectId);

  const totalMeetingHours = agendas.reduce(
    (sum, a) => sum + (a.duration_minutes ?? 0) / 60,
    0,
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      {agendas.length > 0 && (
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-muted-foreground">
            {agendas.length} reuni{agendas.length !== 1 ? "ões" : "ão"}
          </span>
          <span className="font-medium">
            {formatHours(totalMeetingHours)} no total
          </span>
        </div>
      )}

      <div className="space-y-2">
        {agendas.map((agenda) => (
          <button
            key={agenda.id}
            type="button"
            onClick={() => navigate(`/agendas/${agenda.id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-all text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agenda.title}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>
                  {agenda.meeting_date
                    ? format(new Date(agenda.meeting_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })
                    : "Sem data"}
                </span>
                {agenda.duration_minutes != null && (
                  <span>· {formatHours(agenda.duration_minutes / 60)}</span>
                )}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full border text-[10px] font-medium",
                    agenda.agenda_type === "internal"
                      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900"
                      : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900",
                  )}
                >
                  {agenda.agenda_type === "internal" ? "Interna" : "Cliente"}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      {agendas.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Nenhuma reunião vinculada a este projeto.
          <p className="text-xs mt-1">
            Ao criar uma pauta, vincule-a a este projeto.
          </p>
        </div>
      )}
    </div>
  );
}
