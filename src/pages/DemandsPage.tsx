import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronsUpDown, Check, Download, Clock, LayoutGrid, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";
import { useClient } from "@/context/ClientContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  useTicketColumns, useDemandTypes, useDemands, useMoveDemand,
  type DemandRow, type DemandPriority, type DemandFilters,
} from "@/hooks/useDemands";
import { useKanbanSortMode, sortDemandsByMode } from "@/hooks/useKanbanSortMode";
import { useAreasByWorkspace } from "@/hooks/useDemandAreas";
import { useCollapsedColumns } from "@/hooks/useCollapsedColumns";
import { useDemandTaskCounts } from "@/hooks/useDemandTasks";
import { KanbanColumn } from "@/components/demands/KanbanColumn";
import { CollapsedColumnStub } from "@/components/demands/CollapsedColumnStub";
import { TechSwimlanePage } from "@/components/demands/TechSwimlanePage";
// DemandDetailSheet still used elsewhere; navigation now opens dedicated page
import { CreateDemandDialog } from "@/components/demands/CreateDemandDialog";
import { useExportDemandsCSV } from "@/hooks/useExportDemandsCSV";
import { SlaView } from "@/components/demands/SlaView";
import { useSlaDemandsBoard } from "@/hooks/useSla";
import { useAuth } from "@/context/AuthContext";
import {
  useDemandCollaboratorsBatch,
  useMyCollaboratorDemandIds,
} from "@/hooks/useDemandCollaborators";
import { useBlockerTypes, type BlockerType } from "@/hooks/useBlockerTypes";
import { MultiAssigneeFilter } from "@/components/demands/MultiAssigneeFilter";

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
  const { activeWorkspace } = useWorkspace();
  const { data: columns = [], isLoading: colsLoading } = useTicketColumns();
  const { data: types = [] } = useDemandTypes();
  const { data: areas = [] } = useAreasByWorkspace(activeWorkspace);
  const exportCSVMutation = useExportDemandsCSV();
  const { data: slaDemands = [] } = useSlaDemandsBoard();
  const slaVencidos = slaDemands.filter((d) => d.sla_status === "vencido").length;
  const { user } = useAuth();

  // View toggle
  const [view, setView] = useState<"kanban" | "sla">("kanban");

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterArea, setFilterArea] = useState<string>("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [filterAssigneeIds, setFilterAssigneeIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("demands:assignee_ids");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });
  useEffect(() => {
    window.localStorage.setItem("demands:assignee_ids", JSON.stringify(filterAssigneeIds));
  }, [filterAssigneeIds]);

  const { data: myCollabIds = [] } = useMyCollaboratorDemandIds(myTasksOnly);

  // Reset area filter when workspace changes (selected area may not exist in new workspace)
  useEffect(() => {
    setFilterArea("");
  }, [activeWorkspace]);

  const filters: DemandFilters = useMemo(() => ({
    search: debouncedSearch.length >= 3 ? debouncedSearch : undefined,
    client_id: filterClient || undefined,
    demand_type_id: filterType || undefined,
    priority: (filterPriority as DemandPriority) || undefined,
    area_id: filterArea || undefined,
    workspace: activeWorkspace,
    mine_user_id: myTasksOnly && user?.id ? user.id : undefined,
    mine_collab_ids: myTasksOnly ? myCollabIds : undefined,
    assignee_ids: !myTasksOnly && filterAssigneeIds.length > 0 ? filterAssigneeIds : undefined,
  }), [debouncedSearch, filterClient, filterType, filterPriority, filterArea, activeWorkspace, myTasksOnly, user?.id, myCollabIds, filterAssigneeIds]);

  const { data: demands = [], isLoading: demandsLoading } = useDemands(filters);
  const moveMutation = useMoveDemand();

  const demandIds = useMemo(() => demands.map((d) => d.id), [demands]);
  const { data: taskCounts = {} } = useDemandTaskCounts(demandIds);
  const { data: collaboratorsByDemand = {} } = useDemandCollaboratorsBatch(demandIds);
  const { data: blockerTypes = [] } = useBlockerTypes();
  const blockerTypesById = useMemo(() => {
    const map: Record<string, BlockerType> = {};
    for (const bt of blockerTypes) map[bt.id] = bt;
    return map;
  }, [blockerTypes]);

  const navigate = useNavigate();

  const { isCollapsed, toggle: toggleCollapse } = useCollapsedColumns(columns);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createColumnId, setCreateColumnId] = useState<string | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Alert filter from query params (?filter=blocked|forgotten|delivered|overloaded)
  const [searchParams] = useSearchParams();
  const alertFilter = searchParams.get("filter");

  const filteredDemands = useMemo(() => {
    if (!alertFilter) return demands;
    const now = Date.now();
    if (alertFilter === "blocked") {
      return demands.filter((d) => d.is_blocked === true);
    }
    if (alertFilter === "forgotten") {
      return demands.filter((d) => {
        const ts = d.last_updated ? new Date(d.last_updated).getTime() : 0;
        return ts > 0 && (now - ts) / 86_400_000 > 7;
      });
    }
    if (alertFilter === "delivered") {
      return demands.filter((d) => !!d.finished_at);
    }
    return demands;
  }, [demands, alertFilter]);

  const { data: sortMode = "manual" } = useKanbanSortMode();

  const demandsByColumn = useMemo(() => {
    const map = new Map<string, DemandRow[]>();
    for (const col of columns) {
      map.set(col.id, []);
    }
    for (const d of filteredDemands) {
      const arr = map.get(d.column_id);
      if (arr) arr.push(d);
      else map.set(d.column_id, [d]);
    }
    // Apply configured sort within each column
    for (const [colId, list] of map) {
      map.set(colId, sortDemandsByMode(list, sortMode));
    }
    return map;
  }, [columns, filteredDemands, sortMode]);

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
    navigate(`/demands/${demand.id}`);
  };

  const handleAddClick = (columnId: string) => {
    setCreateColumnId(columnId);
    setCreateOpen(true);
  };

  const isLoading = colsLoading || demandsLoading;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header fixo */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border bg-background space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Demandas</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={view === "kanban" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
            </Button>
            <Button
              variant={view === "sla" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("sla")}
            >
              <Clock className="h-4 w-4 mr-1" /> SLA
              {slaVencidos > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">
                  {slaVencidos}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSVMutation.mutate(filters)}
              disabled={exportCSVMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
            <Button onClick={() => { setCreateColumnId(undefined); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova demanda
            </Button>
          </div>
        </div>

        {view === "kanban" && sortMode !== "manual" && (
          <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-1.5">
            Ordenação automática ativa: <strong className="text-foreground">{
              sortMode === "oldest_first" ? "Mais antigos primeiro" :
              sortMode === "newest_first" ? "Mais novos primeiro" :
              "Por criticidade"
            }</strong>. Cards podem ser movidos entre colunas, mas a ordem dentro da coluna é definida pelas configurações.
          </div>
        )}

        {view === "kanban" && (
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar por título..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
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
            <MultiAssigneeFilter
              value={filterAssigneeIds}
              onChange={setFilterAssigneeIds}
              className="w-44"
            />
            <button
              type="button"
              onClick={() => setMyTasksOnly((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-all",
                myTasksOnly
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              <User className="h-4 w-4" />
              Minhas tasks
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === "sla" ? (
          <div className="h-full overflow-auto p-6">
            <SlaView />
          </div>
        ) : isLoading ? (
          <div className="flex gap-4 overflow-x-auto p-6">
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
        ) : activeWorkspace === "tech" ? (
          <TechSwimlanePage
            columns={columns}
            demands={demands}
            taskCounts={taskCounts}
            collaboratorsByDemand={collaboratorsByDemand}
            blockerTypesById={blockerTypesById}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex h-full overflow-hidden">
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 px-6 py-4 min-w-max items-start">
                  {columns.filter((c) => !isCollapsed(c.id)).map((col) => (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      demands={demandsByColumn.get(col.id) ?? []}
                      onCardClick={handleCardClick}
                      onAddClick={handleAddClick}
                      isCollapsed={false}
                      onToggleCollapse={toggleCollapse}
                      taskCounts={taskCounts}
                      collaboratorsByDemand={collaboratorsByDemand}
                      blockerTypesById={blockerTypesById}
                    />
                  ))}
                </div>
              </div>
              {columns.some((c) => isCollapsed(c.id)) && (
                <aside className="shrink-0 flex flex-col gap-2 py-4 pr-4 pl-2 border-l border-border/50">
                  {columns.filter((c) => isCollapsed(c.id)).map((col) => (
                    <CollapsedColumnStub
                      key={col.id}
                      column={col}
                      count={(demandsByColumn.get(col.id) ?? []).length}
                      onClick={() => toggleCollapse(col.id)}
                    />
                  ))}
                </aside>
              )}
            </div>
          </DndContext>
        )}
      </div>

      <CreateDemandDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultColumnId={createColumnId}
        workspace={activeWorkspace}
      />
    </div>
  );
};

export default DemandsPage;
