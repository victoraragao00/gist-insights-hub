

## Sprint S1-B: Módulo de Tickets — Frontend Completo

### Escopo

Implementar o Kanban Board de Demandas com drag-and-drop, sheet de detalhe, modal de criação, e aba de configuração de colunas no Settings. Backend já existe (S1-A concluído).

---

### Arquivos a criar

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/hooks/useDemands.ts` | Hooks: `useTicketColumns`, `useDemandTypes`, `useDemands`, `useDemandActivities`, `useCreateDemand`, `useMoveDemand`, `useUpdateDemand`, `useDeleteDemand` |
| `src/hooks/useManageColumns.ts` | Hook: `useManageColumns` (add/rename/reorder/delete com proteção) |
| `src/pages/DemandsPage.tsx` | Página Kanban Board com filtros, colunas, drag-and-drop |
| `src/components/demands/DemandCard.tsx` | Card de ticket draggable |
| `src/components/demands/DemandDetailSheet.tsx` | Sheet lateral com detalhe completo + timeline |
| `src/components/demands/CreateDemandDialog.tsx` | Dialog para criar nova demanda |
| `src/components/demands/KanbanColumn.tsx` | Coluna do Kanban (header, drop zone, lista de cards) |
| `src/components/demands/ColumnSettingsTab.tsx` | Aba "Colunas do Board" para SettingsPage |

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar rota `/demands` com ErrorBoundary |
| `src/components/AppSidebar.tsx` | Adicionar item "Demandas" com ícone `Kanban` após "Clientes" |
| `src/pages/SettingsPage.tsx` | Adicionar aba "Colunas" no TabsList + TabsContent com `ColumnSettingsTab` |
| `package.json` | Instalar `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` |

---

### Detalhes técnicos

**Hooks (`useDemands.ts`):**
- Todos seguem m4 (staleTime), m5 (queryKey completo), m8 (destructure {data, error}), m9 (useMutation)
- `useTicketColumns`: staleTime 300s, order by position
- `useDemandTypes`: staleTime 300s, filter active=true
- `useDemands(filters)`: staleTime 30s, select com JOINs `clients(name)`, `demand_types(name,color,icon)`, `ticket_columns(name,color)`, queryKey inclui todos os filtros
- `useMoveDemand`: lógica de triggers (started_at/finished_at) + insert activity
- Todos com toast sonner (m3)

**DemandsPage (Kanban):**
- DndContext + SortableContext do @dnd-kit
- Filtros: busca (useDebounce 300ms, min 3 chars), client dropdown, type dropdown, priority dropdown
- Colunas horizontais com overflow-x-auto
- Loading: Skeleton shimmer por coluna
- Empty state global e por coluna

**DemandCard:**
- useSortable do @dnd-kit
- Badge tipo (cor + ícone Lucide dinâmico), badge prioridade (paleta DS 1.4), badge bloqueado
- line-clamp-2 no título, hover shadow transition
- onClick abre DemandDetailSheet

**DemandDetailSheet:**
- Sheet (não Dialog) — manter contexto do board
- Título editável inline (onBlur save)
- Selects para tipo, prioridade, coluna (move via useMoveDemand)
- Textareas para descrição, resultado esperado, notas
- Timeline de demand_activities com ícones por event_type e formatDistanceToNow (date-fns)
- Botão excluir com AlertDialog

**CreateDemandDialog:**
- Dialog com campos obrigatórios (título, cliente, tipo) e opcionais
- Coluna default: primeira coluna (Backlog)
- Submit via useCreateDemand

**ColumnSettingsTab (Settings):**
- Lista com drag-and-drop para reordenar
- Editar nome inline
- Color picker (6 cores predefinidas)
- Indicadores visuais de triggers
- Delete com proteção (count tickets → Dialog com "Mover para" se > 0, AlertDialog simples se 0)

**Paleta de prioridade (alinhada DS 1.4):**
- urgent: red-600/red-50 (dark: red-400/red-950)
- high: orange-600/orange-50
- medium: yellow-600/yellow-50
- low: emerald-600/emerald-50

**Sidebar:** Item "Demandas" com ícone `Kanban` (Lucide), posição index 2 (após Clientes, antes de Busca)

**Rota:** `/demands` com ErrorBoundary wrapper

---

### Conformidade com Checklist CTO

- m1: Tipos explícitos em todos os hooks (sem `any`)
- m2: ErrorBoundary na rota
- m3: sonner exclusivo
- m4: staleTime 30s–300s conforme estabilidade
- m5: queryKey com filtros
- m8: {data, error} destructurado
- m9: useMutation para todas as escritas
- m11: zero imports não usados
- m12: .limit(100) em queries de listagem

### Dependência npm
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

