## Objetivo

Adicionar cronômetro/horas manuais por subdemanda na aba "Subdemandas" e tornar o widget de tempo da sidebar condicional ao número de tasks. Reaproveitar `demand_time_entries` (coluna `task_id` já criada na migração 4-C) e `useDemandTimeEntries` — sem nova tabela nem hook paralelo.

## Arquivos afetados

- `src/hooks/useDemandTimeEntries.ts` — estender para `task_id`
- `src/components/demands/DemandTimeTrackingSection.tsx` — aceitar `taskId` opcional + propagar para mutations
- `src/components/demands/detail/DemandTasksSection.tsx` — adicionar timer compacto por task
- `src/components/demands/detail/DemandSidebar.tsx` — renderizar widget condicional via `useDemandTaskStats`

Nenhuma migração nova. Nenhuma alteração em `supabase/*` ou docs.

## Mudanças no hook `useDemandTimeEntries`

1. `useStartTimer({ demandId, taskId? })`:
   - Guard global passa a selecionar também `task_id, demand_tasks(title)` para gerar mensagem precisa ("timer ativo na task X" vs "demanda Y").
   - INSERT inclui `task_id: taskId ?? null`.

2. `useActiveTimerEntry({ demandId, taskId? })`:
   - Assinatura passa de string para objeto.
   - Se `taskId`: filtra `.eq("task_id", taskId)` (sem `eq demand_id` — task já é única).
   - Se não: `.eq("demand_id", demandId).is("task_id", null)` (timer da demanda direto).
   - `queryKey` inclui `taskId ?? null`.

3. `useAddManualEntry({ demandId, taskId?, hours, description? })`:
   - INSERT inclui `task_id: taskId ?? null`.

4. `useDemandTimeEntries(demandId)` — listagem da seção da demanda continua sem alteração (já lista todas as entries por `demand_id`, incluindo as de tasks, o que é o comportamento desejado quando não há tasks).

5. `useUserActiveTimer()` — incluir `task_id` e `demand_tasks(title)` no select para que tooltips/mensagens distingam task vs demanda.

6. Nova query `useTaskTotalHours(taskId)`: soma client-side de `hours_manual` e `(ended_at - started_at)` filtrando por `task_id`. `staleTime: 30_000`, `enabled: !!taskId`, `queryKey: ["task-total-hours", taskId]`.

7. `invalidateAll` adiciona `["task-total-hours"]` e `["demand-task-stats"]` para refletir somas após start/stop/manual.

## Mudanças no `DemandTimeTrackingSection`

- Aceitar prop opcional `taskId?: string | null`.
- Propagar `taskId` para `useActiveTimerEntry`, `useStartTimer`, `useAddManualEntry`.
- A listagem por `useDemandTimeEntries(demandId)` permanece — quando taskId está ausente (uso na sidebar sem tasks), o componente segue exibindo todas as entries da demanda.

## Sidebar — render condicional

Em `DemandSidebar` (seção "Time tracking"):

```tsx
const { data: taskStats } = useDemandTaskStats(demand.id);
const { data: totalHours = 0 } = useDemandTotalHours(demand.id);
const hasTasks = (taskStats?.total ?? 0) > 0;
```

- `hasTasks === false`: renderiza `<DemandTimeTrackingSection demandId={demand.id} />` (comportamento atual).
- `hasTasks === true`: renderiza um bloco compacto com:
  - "Total registrado" = `formatHours(totalHours)` (vem do RPC, já agrega tasks + diretas).
  - Input numérico + botão "Adicionar" → `useAddManualEntry({ demandId, taskId: null, hours, description: null })` para registrar horas avulsas na demanda.
  - Sem botão Iniciar timer (timer fica nas tasks).

## Aba Subdemandas — timer por task

Em `DemandTasksSection > DemandTaskItem`, adicionar bloco abaixo do header da task:

- Hooks: `useActiveTimerEntry({ demandId, taskId: task.id })`, `useUserActiveTimer()`, `useStartTimer()`, `useStopTimer()`, `useAddManualEntry()`, `useTaskTotalHours(task.id)`.
- `isRunning = !!activeTimer`. `isBlockedByOther = !isRunning && !!userActiveTimer`.
- Se `isRunning`: mostra cronômetro JS (`TaskTimer`) + botão "Pausar" → `stopTimer.mutate({ entryId: activeTimer.id })`.
- Se parado: mostra "⏱ X registradas" (quando `taskHours > 0`), input numérico (Enter chama `addManual.mutate({ demandId, taskId, hours, description: null })`), e botão "Timer" → `startTimer.mutate({ demandId, taskId: task.id })` com `disabled={isBlockedByOther}` e tooltip explicativo.

Componente auxiliar `TaskTimer({ startedAt })` — `setInterval` 1s formatando `HH:MM:SS`, cleanup no unmount.

`demandId` é propagado para `DemandTaskItem` (a section já o conhece).

## Tipos

`Tables<"demand_time_entries">` já reflete a nova coluna `task_id` (regenerado após migração 4-C). Tipagem nas queries com select aninhado usa um helper local equivalente ao já existente em `useUserActiveTimer` (cast `as unknown as` localizado).

## Conformidade Checklist do CTO

- m1: zero `any` (casts mínimos com tipos derivados).
- m4: todas as queries com `staleTime ≥ 30_000`.
- m5: `queryKey` inclui `user?.id`, `demandId` e `taskId` quando aplicável.
- m8: `{ data, error }` destructurado, throw em erro.
- m9: toda escrita via `useMutation`.
- m11: imports limpos (remover `Square` se não usado em algum local; revisar após refactor).

## Verificação manual

Roteiro idêntico ao item "Verificação pós-deploy" da Issue 4-D (10 cenários).
