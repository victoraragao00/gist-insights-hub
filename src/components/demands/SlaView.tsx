import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { List, LayoutGrid } from "lucide-react";
import { useSlaDemandsBoard, type DemandWithSla } from "@/hooks/useSla";
import { DemandSlaQuickSheet } from "@/components/demands/DemandSlaQuickSheet";

const SLA_STATUS_CONFIG = {
  ok: {
    color: "bg-green-50 text-green-700 border-green-200",
    barColor: "bg-green-500",
    label: "No prazo",
  },
  em_risco: {
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    barColor: "bg-yellow-500",
    label: "Em risco",
  },
  vencido: {
    color: "bg-red-50 text-red-700 border-red-200",
    barColor: "bg-red-500",
    label: "Vencido",
  },
} as const;

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

function formatSlaTime(hours: number): string {
  if (hours <= 0) return "Vencido";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function KanbanSlaView({ demands }: { demands: DemandWithSla[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DemandWithSla[]>();
    for (const d of demands) {
      const key = d.column_name ?? "Sem coluna";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [demands]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from(grouped.entries()).map(([colName, items]) => (
        <div key={colName} className="min-w-64 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            {colName} <span className="text-xs font-normal">({items.length})</span>
          </h3>
          {items.map((d) => {
            const config = SLA_STATUS_CONFIG[d.sla_status];
            return (
              <div
                key={d.id}
                className="rounded-lg border bg-card overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
              >
                <div className={`h-[3px] ${config.barColor}`} />
                <div className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium truncate flex-1">{d.title}</p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {d.sla_status === "vencido"
                        ? `−${formatSlaTime(Math.abs(d.sla_remaining_hours))}`
                        : formatSlaTime(d.sla_remaining_hours)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{d.client_name}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                      {config.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {PRIORITY_LABELS[d.priority] ?? d.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SlaView() {
  const { data: demands = [], isLoading } = useSlaDemandsBoard();
  const [viewMode, setViewMode] = useState<"lista" | "kanban">("lista");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);


  const vencidos = demands.filter((d) => d.sla_status === "vencido").length;
  const emRisco = demands.filter((d) => d.sla_status === "em_risco").length;
  const ok = demands.filter((d) => d.sla_status === "ok").length;

  const handleCardClick = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{vencidos}</p>
          <p className="text-xs text-red-600">Vencidos</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{emRisco}</p>
          <p className="text-xs text-yellow-600">Em risco</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{ok}</p>
          <p className="text-xs text-green-600">No prazo</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "lista" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("lista")}
        >
          <List className="h-3.5 w-3.5 mr-1" /> Lista
        </Button>
        <Button
          variant={viewMode === "kanban" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("kanban")}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
        </Button>
      </div>

      {/* Lista */}
      {viewMode === "lista" && (
        <div className="space-y-2">
          {demands.map((demand) => {
            const config = SLA_STATUS_CONFIG[demand.sla_status];
            return (
              <div
                key={demand.id}
                className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => handleCardClick(demand.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{demand.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {demand.client_name} · {demand.column_name}
                      {demand.assignee_name && ` · ${demand.assignee_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {PRIORITY_LABELS[demand.priority] ?? demand.priority}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">SLA: {demand.sla_hours_limit}h</span>
                    <span
                      className={
                        demand.sla_status === "vencido"
                          ? "text-red-600 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {demand.sla_status === "vencido"
                        ? `Vencido há ${formatSlaTime(Math.abs(demand.sla_remaining_hours))}`
                        : `${formatSlaTime(demand.sla_remaining_hours)} restantes`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${config.barColor}`}
                      style={{ width: `${Math.min(demand.sla_percent_used, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {demands.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Todos os tickets estão com SLA cumprido 🎉</p>
            </div>
          )}
        </div>
      )}

      {/* Kanban */}
      {viewMode === "kanban" && <KanbanSlaView demands={demands} />}

      {/* Detail Sheet */}
      <DemandSlaQuickSheet
        demandId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
