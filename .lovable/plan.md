## Sprint TECH 3-B — Swimlane Kanban (Frontend)

Implementar branch CX vs TECH na página de demandas, com layout swimlane por squad no workspace TECH e CRUD de squads em Settings.

### 1. Hook `useSquads` (novo `src/hooks/useSquads.ts`)
Hooks com `staleTime: 300_000`:
- `useSquads()` — squads ativos + members com user_profiles (join `squad_members(user_id, role, user_profiles(...))`)
- `useAllSquads()` — inclui inativos (Settings)
- `useUpdateDemandSquad({ demandId, squadId | null })` — invalida `["demands"]`
- `useCreateSquad`, `useUpdateSquad`, `useDeleteSquad`
- `useAddSquadMember`, `useRemoveSquadMember`

Padrão: `{ data, error }` destructurado, `useMutation` para escrita, `sonner` para toasts.

### 2. `useDemands` — adicionar filtro workspace
- Adicionar `workspace?: 'cx' | 'tech'` a `DemandFilters`.
- `.eq('workspace', filters.workspace)` quando definido.
- queryKey já inclui `filters`, então passa automaticamente.

### 3. `useCreateDemand` — aceitar workspace e squad_id
- Adicionar campos opcionais `workspace` e `squad_id` ao input do mutation.
- Default `workspace = 'cx'` (compatibilidade).

### 4. `DemandsPage` — branch CX vs TECH
- Importar `useWorkspace`.
- Passar `workspace: activeWorkspace` ao `useDemands`.
- Se `activeWorkspace === 'tech'`: renderizar `<TechSwimlanePage ... />` no lugar do bloco kanban (preservar SLA view e botão Nova demanda).
- Se `cx`: layout flat atual integralmente preservado.
- `CreateDemandDialog` recebe novo prop `workspace` para bloquear/forçar valor.

### 5. `TechSwimlanePage` (novo `src/components/demands/TechSwimlanePage.tsx`)
Layout grid: coluna fixa 160px (squad label) + N colunas (`1fr` cada) para colunas do kanban.
- Header: nome + contagem por coluna.
- Linhas: 1 por squad ativo + 1 "Sem squad".
- Componentes internos:
  - `SwimlaneLane`: label + N células.
  - `SwimlaneCell`: `useDroppable` com id `${squadId|'no-squad'}::${columnId}`.
  - `SwimlaneDemandCard`: card compacto (`useDraggable`), título clicável (navigate `/demands/:id`), badge prioridade, primeiro nome do assignee, aging badge (reusa `getAgingStyle`).
- `handleDragEnd`: parse `over.id` → se `column_id` mudou chama `useMoveDemand`; se `squad_id` mudou chama `useUpdateDemandSquad`.
- DnD via `@dnd-kit/core` (`DndContext`, `PointerSensor`, `closestCorners`).

### 6. `CreateDemandDialog` — campo Squad no TECH
- Aceitar prop opcional `workspace?: 'cx' | 'tech'` (default `'cx'`).
- Se `tech`: exibir Select de Squads (com "Sem squad").
- Pré-preencher se usuário pertence a exatamente 1 squad.
- INSERT inclui `workspace` e `squad_id` apropriados.

### 7. `DemandSidebar` — campo Squad
- Adicionar linha "Squad" após Responsável.
- Visível se `activeWorkspace === 'tech'` ou `demand.squad_id` existe.
- Select com bolinha colorida + "Sem squad" + lista de squads. Usa `useUpdateDemandSquad`.

### 8. Settings → aba "Squads" (admin only)
- Novo `src/components/settings/SquadsSettingsTab.tsx` no mesmo padrão de `AreaSettingsTab`:
  - Adicionar squad: nome + color picker (presets) + posição calculada.
  - Lista: bolinha colorida (color picker inline), nome (inline edit on blur), avatares de membros + botão remover, botão adicionar membro (Select com user_profiles ativos não-membros), toggle ativo/inativo, delete se sem demandas vinculadas.
- Registrar tab em `SettingsPage.tsx` (`isAdmin && <TabsTrigger value="squads">Squads</TabsTrigger>`).

### Quality (m1–m11)
- Sem `any`, sem `use-toast`, todos `{ data, error }`, queryKeys completos, `staleTime > 0`, sem imports não usados.
- Layout flat do CX permanece intocado — toda lógica TECH é branch condicional.

### Sem alterações
- Nenhuma migration (banco já pronto via Sprint 3-A).
- `src/integrations/supabase/*`, `.env`, docs `CONTEXT.md`/`AGENTS.md`/`CLAUDE.md` intocados.
