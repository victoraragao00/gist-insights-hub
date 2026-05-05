## Objetivo

Criar página dedicada para subdemandas (`/tasks/:id`), adicionar histórico detalhado de horas (com avatar, autor, tipo Manual/Timer, duração) na própria task e na demanda, e redesenhar a linha da lista de subdemandas para que clicar abra a nova página. Sem migrações; sem alterar tipos do Supabase nem documentação.

## Arquivos afetados

- `src/App.tsx` — adicionar rota `/tasks/:id`.
- `src/pages/TaskDetailPage.tsx` — novo, layout em duas colunas (igual ao padrão da `DemandDetailPage`).
- `src/hooks/useDemandTasks.ts` — adicionar `useTask(id)`, `useTaskTimeEntries(taskId)`, `useDemandTimeEntriesAll(demandId)`. Reutilizar `useUpdateDemandTask`/`useDeleteDemandTask`.
- `src/components/demands/detail/DemandTasksSection.tsx` — redesign do `DemandTaskItem`: linha clicável que navega para `/tasks/:id`, com chips de horas (est/real), responsável, status e datas compactas.
- `src/components/demands/detail/DemandActivityTab.tsx` — adicionar seção "Horas registradas" ao final (resumo por pessoa + entradas individuais colapsáveis).
- `src/components/demands/detail/TimeEntryRow.tsx` — novo componente compartilhado (linha do histórico com avatar/tipo/duração/excluir, prop opcional `showTask`).
- `src/components/demands/DemandTimeTrackingSection.tsx` — aceitar prop `compact` para esconder a lista interna quando usada na sidebar da `TaskDetailPage` (a lista é renderizada no painel principal pelo histórico dedicado).

## Detalhes técnicos

### Rotas e navegação
Em `App.tsx`, adicionar dentro do bloco protegido com `ClientProvider + DashboardLayout`:
```tsx
<Route path="/tasks/:id" element={<ErrorBoundary><TaskDetailPage /></ErrorBoundary>} />
```

### Hooks (em `useDemandTasks.ts`)
- `useTask(taskId)`:
  - `queryKey: ["task", taskId]`, `staleTime: 30_000`, `enabled: !!taskId`.
  - Select com aliases por nome de constraint para resolver os 2 FKs para `user_profiles`:
    ```
    *,
    assignee:user_profiles!demand_tasks_assignee_id_fkey(id, full_name, email),
    creator:user_profiles!demand_tasks_created_by_fkey(id, full_name, email),
    demands!demand_tasks_demand_id_fkey(
      id, title, workspace,
      clients(id, name),
      ticket_columns(name)
    )
    ```
  - Cast local `as unknown as TaskDetail` (sem `any`).
- `useTaskTimeEntries(taskId)`:
  - `queryKey: ["task-time-entries", taskId]`, `staleTime: 30_000`.
  - Select: `id, started_at, ended_at, hours_manual, description, created_at, user_id, user_profiles!demand_time_entries_user_id_fkey(id, full_name, email)`. Filtrar por `task_id`.
- `useDemandTimeEntriesAll(demandId)`:
  - `queryKey: ["demand-time-entries-all", demandId]`, `staleTime: 30_000`.
  - Select adicional: `task_id, demand_tasks!demand_time_entries_task_id_fkey(id, title)`.
- Adicionar `["task", id]` e `["task-time-entries"]` e `["demand-time-entries-all"]` à invalidação dos hooks de mutação existentes (`useUpdateDemandTask`, `useDeleteDemandTask`, `invalidateAll` em `useDemandTimeEntries.ts`).

### `TaskDetailPage.tsx`
Layout: `max-w-6xl mx-auto p-6`, header (breadcrumb + título inline-editável + StatusSelect + chips cliente/coluna), grid responsivo `flex-1` / `lg:w-[280px]`.

- **Header**: breadcrumb `← {demand.title} / Subdemandas` (botão volta para `/demands/{demand_id}`), `<input>` para título com save-on-blur via `useUpdateDemandTask`.
- **StatusSelect**: componente local com 3 opções (`open`, `in_progress`, `done`). Mudança chama `useUpdateDemandTask`.
- **Main**:
  - Bloco "Descrição" com `<textarea>` inline.
  - Bloco "Histórico de horas" — usa `useTaskTimeEntries(id)` e renderiza `TimeEntryRow` por entrada; vazio mostra placeholder.
- **Sidebar** (280px):
  - "Detalhes" (Responsável combobox via `useUpdateDemandTask`, Criado por, Criado em, Início, Conclusão — datas formatadas em `dd MMM yyyy [HH:mm]` com `date-fns/locale/ptBR`).
  - "Horas" (estimadas inline-editáveis, registradas via `useTaskTotalHours`, barra de progresso com cor `bg-orange-500` se ultrapassou — usar tokens semânticos `text-destructive` quando possível; o spec pede laranja, manter explícito mas justificável).
  - "Timer": `<DemandTimeTrackingSection demandId={task.demand_id} taskId={task.id} compact />`.

### Redesign `DemandTaskItem`
Substituir o card atual por uma linha mais densa e clicável:
- Container `cursor-pointer` que faz `navigate(/tasks/${task.id})`.
- Botão de status à esquerda (`stopPropagation` para alternar sem abrir).
- Título truncado, line-through quando done.
- Chips à direita: avatar do responsável, `{est}h / {real}h`, badge de status, `desde dd/MM` quando started sem finished, `✓ dd/MM` quando finished.
- Botão lixeira (hover) com `stopPropagation`.
- Remover o bloco timer expandido (timer agora vive na `TaskDetailPage`). Remover `useActiveTimerEntry`/`useStartTimer`/`useStopTimer`/`useAddManualEntry`/`useTaskTotalHours` desnecessários e seus imports — manter apenas `useTaskTotalHours` para mostrar o total na linha.

### `TimeEntryRow` (compartilhado)
Props: `entry`, `showTask?: boolean`, `onDelete: (id: string) => void`, `currentUserId?: string`.
- Avatar com iniciais (utility local `getInitials`).
- Badge "Manual" vs "Timer" (cores: muted vs blue).
- Duração via `entryHours()` reutilizando helper já existente em `useDemandTimeEntries.ts`.
- Linha de meta: data formatada; se `showTask && entry.demand_tasks?.title` exibe `· task: ...`.
- Botão excluir só aparece se `entry.user_id === currentUserId` (RLS já restringe).

### `DemandActivityTab`
- Adicionar `useDemandTimeEntriesAll(demandId)` e `useDeleteTimeEntry()`.
- Após a timeline, renderizar seção "Horas registradas" com:
  - Resumo por pessoa: `Object.entries(hoursByPerson)` (agregação client-side com `entryHours`).
  - `<Collapsible>` (já em `components/ui/collapsible`) para "Ver todas as N entradas" → renderiza `TimeEntryRow` com `showTask`.

### `DemandTimeTrackingSection`
Adicionar prop `compact?: boolean`. Quando `true`, esconder o bloco "entries list" interno (a `TaskDetailPage` mostra o histórico no painel principal). Sem mudança de comportamento padrão.

### Conformidade Checklist do CTO
- m1: zero `any` (casts mínimos em selects aninhados, idêntico ao padrão atual).
- m4: todas as queries com `staleTime: 30_000`.
- m5: `queryKey` inclui id relevante (taskId/demandId).
- m8: `{ data, error }` destructurado em todas as chamadas.
- m9: toda escrita via `useMutation` (reaproveitando hooks existentes).
- m11: imports limpos após remoção do timer inline em `DemandTaskItem`.
- Sem `use-toast`, apenas `sonner` (já em uso).

## Verificação manual
Idêntica ao roteiro de 11 passos da Issue 4-F.
