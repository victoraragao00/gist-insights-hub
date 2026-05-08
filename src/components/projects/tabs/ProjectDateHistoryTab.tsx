import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, History } from "lucide-react";
import { useProjectDateHistory, DATE_FIELD_LABELS } from "@/hooks/useProjectDateHistory";

interface Props {
  projectId: string;
}

function fmt(v: string | null): string {
  if (!v) return "—";
  return format(new Date(v + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
}

export function ProjectDateHistoryTab({ projectId }: Props) {
  const { data: history = [], isLoading } = useProjectDateHistory(projectId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando histórico...</p>;
  }

  if (history.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-8 text-center">
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Nenhuma alteração de datas registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {history.map((h) => {
        const who = h.user_profiles?.full_name || h.user_profiles?.email || "Sistema";
        return (
          <li key={h.id} className="ml-4">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
            <div className="text-xs text-muted-foreground">
              {format(new Date(h.changed_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
            <div className="text-sm mt-0.5">
              <span className="font-medium">{who}</span>{" "}
              alterou{" "}
              <span className="font-medium">{DATE_FIELD_LABELS[h.field]}</span>:{" "}
              <span className="inline-flex items-center gap-1.5 font-mono text-xs px-1.5 py-0.5 rounded bg-muted">
                {fmt(h.old_value)}
                <ArrowRight className="h-3 w-3" />
                {fmt(h.new_value)}
              </span>
            </div>
            {h.note && <div className="text-xs text-muted-foreground mt-1 italic">{h.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}
