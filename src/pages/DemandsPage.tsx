import { useState, useMemo, useCallback } from "react";
import {
  DndContext, closestCorner, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useClient } from "@/context/ClientContext";
import {
  useTicketColumns, useDemandTypes, useDemands, useMoveDemand,
  type DemandRow, type DemandPriority, type DemandFilters,
} from "@/hooks/useDemands";
import { KanbanColumn } from "@/components/demands/KanbanColumn";
import { DemandDetailSheet } from "@/components/demands/DemandDetailSheet";
import { CreateDemandDialog } from "@/components/demands/CreateDemandDialog";

const DemandsPage = () => {
  const { clients } = useClient();
  const { data: columns = [], isLoading: colsLoading } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");

  const filters: DemandFilters = useMemo(() => ({
    search: debouncedSearch.length >= 3 ? debouncedSearch : undefined,
    client_id: filterClient || undefined,
    demand_type_id: filterType || undefined,
    priority: (filterPriority as DemandPriority) || undefined,
  }), [debouncedSearch, filterClient, filterType, filterPriority]);

  const { data: demands = [], isLoading: demandsLoading } = useDemands(filters);
  const moveMutation = useMoveDemand();

  // Sheet state
  const [selectedDemand, setSelectedDemand] = useState<DemandRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const demandsByColumn = useMemo(() => {
    const map = new Map<string, DemandRow[]>();
    for (const col of columns) {
      map.set(col.id, []);
    }
    for (const d of demands) {
      const arr = map.get(d.column_id);
      if (arr) arr.push(d);
      else map.set(d.column_id, [d]);
    }
    return map;
  }, [columns, demands]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const demandId = active.id as string;
    const demand = demands.find((d) => d.id === demandId);
    if (!demand) return;

    // Determine target column: over could be a column or another demand
    let targetColumnId = over.id as string;
    const isColumn = columns.some((c) => c.id === targetColumnId);
    if (!isColumn) {
      // Dropped on another demand — find its column
      const targetDemand = demands.find((d) => d.id === targetColumnId);
      if (targetDemand) targetColumnId = targetDemand.column_id;
      else return;
    }

    if (targetColumnId === demand.column_id) return;

    const targetCol = columns.find((c) => c.id === targetColumnId);
    if (!targetCol) return;

    moveMutation.mutate({
      demandId,
      targetColumnId,
      targetPosition: 0,
      sourceColumnName: demand.ticket_columns?.name ?? "",
      targetColumnName: targetCol.name,
      currentStartedAt: demand.started_at,
      targetTriggersStartedAt: targetCol.triggers_started_at ?? false,
      targetTriggersFinishedAt: targetCol.triggers_finished_at ?? false,
    });
  }, [demands, columns, moveMutation]);

  const handleCardClick = (demand: DemandRow) => {
    setSelectedDemand(demand);
    setSheetOpen(true);
  };

  const handleAddClick = (columnId: string) => {
    setCreateColumnId(columnId);
    setCreateOpen(true);
  };

  const isLoading = colsLoading || demandsLoading;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Demandas</h1>
        <Button onClick={() => { setCreateColumnId(undefined); setCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova demanda
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-56"
        />
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="urgent">Urgente</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-64 space-y-3">
              <Skeleton className="h-6 w-32 animate-shimmer" />
              <Skeleton className="h-24 w-full animate-shimmer" />
              <Skeleton className="h-24 w-full animate-shimmer" />
            </div>
          ))}
        </div>
      ) : demands.length === 0 && columns.length > 0 && (filters.search || filters.client_id || filters.demand_type_id || filters.priority) ? (
        <div className="text-center py-16 text-muted-foreground">
          Nenhuma demanda encontrada com os filtros selecionados
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorner} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                demands={demandsByColumn.get(col.id) ?? []}
                onCardClick={handleCardClick}
                onAddClick={handleAddClick}
              />
            ))}
          </div>
        </DndContext>
      )}

      {/* Detail Sheet */}
      <DemandDetailSheet
        demand={selectedDemand}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Create Dialog */}
      <CreateDemandDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultColumnId={createColumnId}
      />
    </div>
  );
};

export default DemandsPage;
