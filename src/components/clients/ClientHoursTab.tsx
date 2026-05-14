import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Clock, FolderKanban, Inbox, AlertCircle } from "lucide-react";
import { useClientHours, type ClientHoursDemandRef } from "@/hooks/useClientHours";
import { formatHours } from "@/lib/formatHours";

interface Props { clientId: string }

function DemandsTable({ demands }: { demands: ClientHoursDemandRef[] }) {
  if (!demands.length) {
    return <p className="text-xs text-muted-foreground py-3 px-1">Nenhuma demanda com horas registradas.</p>;
  }
  return (
    <div className="divide-y divide-border/60">
      {demands.map((d) => (
        <Link
          key={d.id}
          to={`/demands/${d.id}`}
          className="flex items-center justify-between py-2 px-1 text-sm hover:bg-muted/40 rounded transition-colors"
        >
          <span className="truncate flex-1 mr-3">{d.title}</span>
          <span className="font-medium text-foreground tabular-nums shrink-0">{formatHours(d.hours)}</span>
        </Link>
      ))}
    </div>
  );
}

function HoursSection({
  icon,
  title,
  totalHours,
  demandCount,
  demands,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  totalHours: number;
  demandCount: number;
  demands: ClientHoursDemandRef[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border border-border rounded-xl">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3 hover:bg-muted/30 transition-colors rounded-t-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {icon}
                <CardTitle className="text-base font-semibold truncate text-left">{title}</CardTitle>
                <Badge variant="outline" className="text-xs shrink-0">{demandCount} demanda{demandCount === 1 ? "" : "s"}</Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-lg font-bold text-foreground tabular-nums">{formatHours(totalHours)}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <DemandsTable demands={demands} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function ClientHoursTab({ clientId }: Props) {
  const { data, isLoading, isError } = useClientHours(clientId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full animate-shimmer" />
        <Skeleton className="h-20 w-full animate-shimmer" />
        <Skeleton className="h-20 w-full animate-shimmer" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">Não foi possível carregar as horas do cliente.</p>
      </div>
    );
  }

  const total = Number(data.total_hours ?? 0);
  const avulsasHours = Number(data.avulsas?.hours ?? 0);
  const projetos = data.projetos ?? [];

  if (total === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">Nenhuma hora registrada para este cliente ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-border rounded-xl bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total de horas gastas</p>
            <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{formatHours(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatHours(avulsasHours)} em demandas avulsas · {formatHours(total - avulsasHours)} em projetos
            </p>
          </div>
          <Clock className="h-10 w-10 text-primary/40 shrink-0" />
        </CardContent>
      </Card>

      <HoursSection
        icon={<Inbox className="h-4 w-4 text-muted-foreground" />}
        title="Demandas avulsas"
        totalHours={avulsasHours}
        demandCount={data.avulsas?.demand_count ?? 0}
        demands={data.avulsas?.demands ?? []}
      />

      {projetos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhum projeto com horas registradas.
        </p>
      ) : (
        projetos.map((p) => (
          <HoursSection
            key={p.project_id}
            icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
            title={
              <Link to={`/projects/${p.project_id}`} className="hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                {p.project_name}
              </Link>
            }
            totalHours={Number(p.hours ?? 0)}
            demandCount={p.demand_count ?? 0}
            demands={p.demands ?? []}
          />
        ))
      )}
    </div>
  );
}

export default ClientHoursTab;
