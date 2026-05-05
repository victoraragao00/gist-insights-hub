## Plano: Frontend de Subdemandas (`demand_tasks`)

Implementa a UI hierárquica Projeto → Demanda → Subdemanda consumindo a tabela criada no Sprint 4-A.

### 1. Hook `src/hooks/useDemandTasks.ts` (novo)

Tipos via `Tables<"demand_tasks">` + `DemandTaskStatus = "open" | "in_progress" | "done"`.

Queries:
- `useDemandTasks(demandId)` — `select *, user_profiles!demand_tasks_assignee_id_fkey(id, full_name, email)`, `order(position, created_at)`, `staleTime: 30_000`.
- `useDemandTaskStats(demandId)` — `rpc("get_demand_task_stats", { p_demand_id })`, `staleTime: 15_000`. Normaliza JSON em `DemandTaskStats` tipado.
- `useDemandTaskCounts(demandIds[])` — agregação batch `SELECT demand_id, status FROM demand_tasks WHERE demand_id IN (...)` → `Record<string, { total, done, completion_pct }>`. Usado pelos cards do Kanban e ProjectDetailPage. queryKey inclui `user?.id` + lista ordenada de IDs.

Mutations (todas `useMutation` + `{ data, error }` destructurado + invalidação programática):
- `useCreateDemandTask` — INSERT com `created_by = auth user`, status default `open`. Invalida `demand-tasks`, `demand-task-stats`, `demand-task-counts`.
- `useUpdateDemandTask` — UPDATE genérico (title, description, assignee_id, hours_estimated, hours_actual, status, position). Após sucesso invalida também `["demand", id]` e `["demands"]` porque o trigger pode ter movido a demanda para a coluna de conclusão.
- `useDeleteDemandTask` — DELETE por id.
- `useReorderDemandTasks` — UPDATE batch de posições.

### 2. Componente `src/components/demands/detail/DemandTasksSection.tsx` (novo)

Renderizado em `DemandContentTab.tsx` entre "Resultado esperado" e "Notas internas" (antes de "Resolução"), recebendo `demand: DemandRow`.

Estrutura:
- Header: "Subdemandas" + botão `+ Adicionar`.
- Barra de progresso: `done/total · completion_pct% · {formatHours(hours_estimated_sum)} estimadas`. Cor `bg-emerald-500` se 100%, senão `bg-primary`.
- Lista de `DemandTaskItem` (subcomponente interno).
- `AddTaskInline` no rodapé (Enter salva, Esc cancela).

`DemandTaskItem` (interno, reutiliza padrões do projeto):
- Toggle de status à esquerda (clique avança open → in_progress → done → open).
- Título inline-editável (`<input>` com `defaultValue` + save-on-blur via `useUpdateDemandTask`).
- Metadados em linha: avatar do responsável (`AssigneeDisplay`) + Select de troca (Popover/Combobox simples sobre `user_profiles` ativos), inputs numéricos `hours_estimated` / `hours_actual` (este último apenas quando status ≠ open), badge de status.
- Descrição colapsável (`<textarea>` save-on-blur), toggle por ícone `AlignLeft`.
- Botão excluir → `AlertDialog` de confirmação.
- Hover revela ações.

Nada de `any`; status usa o type union; cores via tokens (emerald/primary já usados no projeto). Não usa `tailwindcss-animate` extra.

### 3. Chip de progresso nos cards do Kanban

- `DemandsPage.tsx`: extrair `demandIds = demands.map(d => d.id)`, chamar `useDemandTaskCounts(demandIds)`, passar `taskCounts` para `KanbanColumn` → `DemandCard` e para `TechSwimlanePage` → `SwimlaneDemandCard`.
- `DemandCard.tsx`: novo prop opcional `taskCount?: { total; done }`. Renderiza no rodapé chip `<CheckSquare /> done/total` apenas se `total > 0`. Verde se `done === total`, senão `bg-muted`.
- `KanbanColumn.tsx`: aceita `taskCounts?: Record<string, { total; done }>` e repassa para cada `DemandCard`.
- `TechSwimlanePage.tsx`: mesmo prop em `SwimlaneDemandCard` — chip compacto `text-[10px]` ao lado do aging badge.

### 4. ProjectDetailPage / `ProjectDemandsTab.tsx`

- Coleta `demandIds` da lista, chama `useDemandTaskCounts(demandIds)`.
- Mini progress bar (`h-1`) abaixo da linha de metadados de cada demanda quando `total > 0`, com label `done/total`.

### Conformidade com checklist CTO

- m1: Sem `any`; tipos via `Tables<"demand_tasks">` e `DemandTaskStats` tipado.
- m4/m5: `staleTime` correto; queryKeys incluem `demandId` e (para counts) `user?.id` + ids ordenados.
- m6: Inputs usam `defaultValue` + `onBlur` (sem refs DOM globais).
- m8: `{ data, error }` sempre destructurado; throws propagados.
- m9: Toda escrita por `useMutation`.
- m10: `invalidateQueries` programática (sem `refetch()` descartado).
- m11: Imports limpos.

### Arquivos criados/modificados

- **Criar:** `src/hooks/useDemandTasks.ts`, `src/components/demands/detail/DemandTasksSection.tsx`.
- **Editar:** `src/components/demands/detail/DemandContentTab.tsx` (montar seção), `src/components/demands/DemandCard.tsx` (chip), `src/components/demands/KanbanColumn.tsx` (props passthrough), `src/components/demands/TechSwimlanePage.tsx` (chip + fetch counts), `src/pages/DemandsPage.tsx` (fetch counts e props), `src/components/projects/tabs/ProjectDemandsTab.tsx` (mini bar).

### Não tocado

- `src/integrations/supabase/*`, `supabase/migrations/*`, `.env`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`. Sem migrations nesta sessão.
