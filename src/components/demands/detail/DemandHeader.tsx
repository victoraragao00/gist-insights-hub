import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUpdateDemand, type DemandRow } from "@/hooks/useDemands";
import { columnBadgeClass, priorityBadgeClass, priorityLabel } from "./priorityBadgeStyles";

interface DemandHeaderProps {
  demand: DemandRow;
}

export function DemandHeader({ demand }: DemandHeaderProps) {
  const updateMutation = useUpdateDemand();
  const [title, setTitle] = useState(demand.title);

  useEffect(() => {
    setTitle(demand.title);
  }, [demand.id, demand.title]);

  const handleBlur = () => {
    const next = title.trim();
    if (next && next !== demand.title) {
      updateMutation.mutate({
        id: demand.id,
        fields: { title: next },
        fieldLabel: "Título",
      });
    } else if (!next) {
      setTitle(demand.title);
    }
  };

  return (
    <header className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link to="/demands">
            <ChevronLeft className="h-4 w-4" /> Demandas
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-3 flex-wrap">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          aria-label="Título da demanda"
          className="text-2xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 shadow-none flex-1 min-w-0"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {demand.ticket_columns?.name && (
          <Badge
            variant="outline"
            className={`text-xs ${columnBadgeClass(demand.ticket_columns.name)}`}
          >
            {demand.ticket_columns.name}
          </Badge>
        )}
        <Badge variant="outline" className={`text-xs ${priorityBadgeClass(demand.priority)}`}>
          {priorityLabel(demand.priority)}
        </Badge>
        {demand.demand_types?.name && (
          <Badge
            variant="outline"
            className="text-xs bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900"
          >
            {demand.demand_types.name}
          </Badge>
        )}
        {demand.clients?.name && (
          <span className="text-sm text-muted-foreground">• {demand.clients.name}</span>
        )}
      </div>
    </header>
  );
}
