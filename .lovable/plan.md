
## Plano: Frontend A — Tasks, Collaborators, Blockers

### Hooks novos

**`src/hooks/useDemandCollaborators.ts`**
- `useDemandCollaborators(demandId)` — lista colaboradores de uma demanda (join `user_profiles!demand_collaborators_user_id_fkey`), `staleTime: 30s`
- `useDemandCollaboratorsBatch(demandIds[])` — batch para o Kanban evitar N+1, retorna `Record<demand_id, Collaborator[]>`
- `useMyCollaboratorDemandIds(enabled)` — IDs onde o usuário logado é colaborador (filtro "Minhas tasks")
- `useAddCollaborator()` — INSERT, ignora erro `23505` (unique) → idempotente
- `useRemoveCollaborator()` — DELETE composto por `demand_id + user_id`
- Todos invalidam `demand_collaborators`, `demand_collaborators_batch`, `my_collaborator_demand_ids`

**`src/hooks/useBlockerTypes.ts`**
- `useBlockerTypes()` — apenas ativos, ordem por `position`, `staleTime: 5min`
- `useAllBlockerTypes()` — incluindo inativos (Settings)
- `useCreateBlockerType()`, `useUpdateBlockerType()`, `useToggleBlockerTypeActive()` (sem delete — preserva histórico)

### Filtro "Minhas tasks"

`DemandsPage.tsx`: adiciona toggle button no header com ícone `User` e estado `myTasksOnly`. Adiciona ao `filters: DemandFilters` o campo opcional `mine_user_id` (só preenchido quando ligado).

`useDemands.ts`:
- Estende `DemandFilters` com `mine_user_id?: string` e `mine_collab_ids?: string[]`
- Quando `mine_user_id` presente, aplica `.or("assignee_id.eq.<id>,id.in.(<collab_ids>)")` (PostgREST). Se `mine_collab_ids` vazio, usa apenas `eq("assignee_id", id)`.

`DemandsPage`: chama `useMyCollaboratorDemandIds(myTasksOnly)` antes de montar `filters`, repassa IDs.

### Avatares no DemandCard (owner + colabs)

`DemandCard.tsx` recebe novas props opcionais `collaborators?: DemandCollaborator[]` e `blockerType?: BlockerType | null`.
- Avatar do owner ganha `ring-2 ring-primary` para destaque
- Empilha até 2 avatares de colaboradores com `-ml-1.5`, fundo escuro neutro
- Excedente vira chip `+N`
- Badge de bloqueio passa a usar `blockerType.icon + name` quando disponível, fallback `🔒 Bloqueado`

`KanbanColumn` e `TechSwimlanePage` passam `collaboratorsByDemand` e `blockerTypesById` (Maps) para cada `DemandCard`.

`DemandsPage` e `TechSwimlanePage`:
- Chamam `useDemandCollaboratorsBatch(demandIds)` e `useBlockerTypes()`
- Constroem map por demanda e passam adiante

### DemandSidebar — bloqueio com tipo + colaboradores

Substitui o `Dialog` atual de bloqueio:
- Grid 2 cols com botões dos `blocker_types` (ícone + nome), seleção visual
- Textarea opcional `blocker_reason` (livre)
- `handleBlock` agora salva `is_blocked, blocker_type_id, blocker_reason, blocked_at, blocked_by` (texto livre opcional). Trigger SQL gravará histórico.
- Estado bloqueado mostra badge com `icon + name` do tipo + razão + botão Desbloquear

Nova seção "Colaboradores" entre Responsável e RFI:
- Lista colaboradores como chips com avatar 4x4 + primeiro nome + X (visível em hover)
- Chip "+ Adicionar" abre `Popover` com `Command` (search) listando `userProfiles` excluindo `assignee_id` e já presentes
- Usa `useAddCollaborator` / `useRemoveCollaborator`

### Settings → aba "Bloqueios" (admin)

**Novo:** `src/components/settings/BlockerTypesSettingsTab.tsx` — segue padrão de `AreaSettingsTab`:
- Form de adicionar (nome, seletor de ícone simples — input texto pequeno aceitando emoji, paleta de cores preset)
- Tabela com inline edit de nome, paleta de cores, contador (opcional pular para v1), toggle ativo/inativo (sem botão Excluir)
- Hook: `useAllBlockerTypes`, `useCreateBlockerType`, `useUpdateBlockerType`, `useToggleBlockerTypeActive`

`SettingsPage.tsx`:
- Adiciona `<TabsTrigger value="blockers">Bloqueios</TabsTrigger>` (admin only) entre "Áreas" e "Pautas"
- Adiciona `<TabsContent value="blockers"><BlockerTypesSettingsTab /></TabsContent>`

### Qualidade
- Todos os `useQuery` com `staleTime ≥ 30s` e `queryKey` incluindo `user?.id` quando aplicável (m4, m5)
- Toda escrita via `useMutation` com `toast` `sonner` (m9)
- `{ data, error }` destructurado em todas as queries (m8)
- Sem `any`, sem imports órfãos (m1, m11)
