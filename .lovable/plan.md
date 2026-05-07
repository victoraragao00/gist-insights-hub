## Plan: horas planejadas, vínculos por cliente e aba Reuniões

### 1. Migration (`supabase/migrations/...`)
- `ALTER TABLE projects ADD COLUMN IF NOT EXISTS hours_estimated NUMERIC(6,2)` + COMMENT.
- Recriar `get_project_stats` para incluir no JSON de retorno:
  - `hours_estimated` (do `projects`)
  - `hours_progress_pct` = `ROUND(total_hours / hours_estimated * 100, 1)` ou `NULL` quando sem estimativa.
- Manter assinatura/permissões existentes da função.

### 2. Types e hooks (`src/hooks/useProjects.ts`)
- `ProjectRow`: adicionar `hours_estimated: number | null`.
- `PROJECT_SELECT`: incluir `hours_estimated`.
- `UpdateProjectInput.fields`: aceitar `hours_estimated: number | null`.
- `ProjectStatsData` (`src/lib/projectStatus.ts`): adicionar `hours_estimated: number | null` e `hours_progress_pct: number | null`.
- Novo `useUnassignedDemandsForProject(project)`:
  - `queryKey: ["linkable_demands", project.id, project.client_id, project.is_internal, query]`.
  - Se `is_internal` → `.eq("workspace","tech")`.
  - Senão se `client_id` → `.eq("client_id", project.client_id)`.
  - Continua filtrando `project_id IS NULL` + busca por título.

### 3. ProjectDetailPage — sidebar de horas
- Novo card "Horas" (após "Tempo total"):
  - Linha "Planejadas" com `HoursEditField` inline (input `type=number`, save-on-blur/Enter, Escape cancela) chamando `updateProject.mutate({ id, fields: { hours_estimated } })`.
  - Linha "Registradas" com `formatHours(stats.total_hours)`.
  - Barra de progresso quando `hours_estimated > 0`: cor `bg-primary`, vira `bg-destructive` se `>100%`; label `X% utilizado` e `+Yh acima` quando excedido.
- Componente `HoursEditField` colocado no mesmo arquivo (igual ao `ProjectDueDateField`).

### 4. Aba "Demandas" — filtro por cliente
- `LinkDemandDialog` recebe `project` (não só `projectId`) e usa `useUnassignedDemandsForProject` em vez de `useUnassignedDemands`.
- Atualizar chamada em `ProjectDemandsTab` para passar o objeto `project`.
- Em `ProjectDemandsTab` (lista de demandas vinculadas), exibir badge "Cliente diferente" quando `demand.client_id !== project.client_id` e o projeto não é interno.

### 5. Aba "Reuniões"
- Novo `TabsTrigger value="meetings"` entre Demandas e Squad em `ProjectDetailPage`.
- Novo `src/components/projects/tabs/ProjectMeetingsTab.tsx`:
  - Usa `useProjectAgendas(projectId)` (já existe em `useMeetingAgendas`).
  - Cabeçalho com contagem + soma de horas (sum `duration_minutes/60`).
  - Lista de pautas com data (`dd/MM/yyyy`), duração (`formatHours`), badge `Interna`/`Cliente`, navega para `/agendas/:id`.
  - Empty state amigável.

### 6. CreateAgendaDialog — projetos compatíveis com o cliente
- Substituir o uso atual (`useProjects("tech") + useProjects("cx")`) por novo `useCompatibleProjects(clientId)`:
  - `queryKey: ["compatible_projects", clientId]`.
  - `select id, title, is_internal, clients(name)` + `.is("cancelled_at", null)`.
  - Quando `clientId`: `.or("client_id.eq.<id>,is_internal.eq.true")`.
- Limpar `projectId` quando o `clientId` muda para evitar seleção inválida.
- Mostrar badge "Interno" e nome do cliente nas opções.

### 7. Qualidade
- Toda escrita via `useMutation` (já existente; `updateProject` cobre hours_estimated).
- Remover imports não usados que sobrarem após o refactor (m11).
- Apenas `sonner`; sem alterações em arquivos protegidos.

### Verificação
1. Editar horas planejadas → toast "Projeto atualizado", barra aparece.
2. Excedendo planejado → barra vermelha + "+Xh acima".
3. Link de demandas em projeto de cliente → só demandas do cliente; em projeto interno → todas TECH.
4. Demanda legada de outro cliente → badge "Cliente diferente".
5. Aba Reuniões lista pautas vinculadas e navega para `/agendas/:id`.
6. CreateAgendaDialog filtra projetos pelo cliente da pauta.
