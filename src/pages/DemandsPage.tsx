import { useState, useMemo, useCallback } from "react";
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useClient } from "@/context/ClientContext";
import {
  useTicketColumns, useDemandTypes, useDemands, useMoveDemand,
  type DemandRow, type DemandPriority, type DemandFilters,
} from "@/hooks/useDemands";
import { useDemandAreas } from "@/hooks/useDemandAreas";
import { KanbanColumn } from "@/components/demands/KanbanColumn";
import { DemandDetailSheet } from "@/components/demands/DemandDetailSheet";
import { CreateDemandDialog } from "@/components/demands/CreateDemandDialog";

// ── Filter Combobox ──

interface FilterComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  options: { value: string; label: string }[];
  className?: string;
}

function FilterCombobox({ value, onValueChange, placeholder, searchPlaceholder, options, className }: FilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-9 justify-between font-normal", className)}
        >
          <span className="truncate">{selectedLabel && value !== "" ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-52" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Nenhum resultado</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value === value ? "" : opt.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const DemandsPage = () => {
  const { clients } = useClient();
  const { data: columns = [], isLoading: colsLoading } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: areas = [] } = useDemandAreas();

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterArea, setFilterArea] = useState<string>("");

  const filters: DemandFilters = useMemo(() => ({
    search: debouncedSearch.length >= 3 ? debouncedSearch : undefined,
    client_id: filterClient || undefined,
    demand_type_id: filterType || undefined,
    priority: (filterPriority as DemandPriority) || undefined,
    area_id: filterArea || undefined,
  }), [debouncedSearch, filterClient, filterType, filterPriority, filterArea]);

  const { data: demands = [], isLoading: demandsLoading } = useDemands(filters);
  const moveMutation = useMoveDemand();

  // Sheet state — store only ID to avoid stale object
  const [selectedDemandId, setSelectedDemandId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const selectedDemand = useMemo(
    () => (selectedDemandId ? demands.find((d) => d.id === selectedDemandId) ?? null : null),
    [selectedDemandId, demands]
  );

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
    setSelectedDemandId(demand.id);
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

        {/* Client combobox */}
        <FilterCombobox
          value={filterClient}
          onValueChange={setFilterClient}
          placeholder="Cliente"
          searchPlaceholder="Buscar cliente..."
          options={[
            { value: "all", label: "Todos" },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="w-44"
        />

        {/* Type combobox */}
        <FilterCombobox
          value={filterType}
          onValueChange={setFilterType}
          placeholder="Tipo"
          searchPlaceholder="Buscar tipo..."
          options={[
            { value: "all", label: "Todos" },
            ...types.map((t) => ({ value: t.id, label: t.name })),
          ]}
          className="w-40"
        />

        {/* Priority combobox */}
        <FilterCombobox
          value={filterPriority}
          onValueChange={setFilterPriority}
          placeholder="Prioridade"
          searchPlaceholder="Buscar prioridade..."
          options={[
            { value: "all", label: "Todas" },
            { value: "urgent", label: "Urgente" },
            { value: "high", label: "Alta" },
            { value: "medium", label: "Média" },
            { value: "low", label: "Baixa" },
          ]}
          className="w-36"
        />

        {/* Area combobox */}
        <FilterCombobox
          value={filterArea}
          onValueChange={setFilterArea}
          placeholder="Área"
          searchPlaceholder="Buscar área..."
          options={[
            { value: "all", label: "Todas" },
            ...areas.map((a) => ({ value: a.id, label: a.name })),
          ]}
          className="w-36"
        />
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
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
