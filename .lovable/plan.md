# Plano: Agendas com duração/projeto/resumo + bypass TECH

## Estado atual

- `CreateAgendaDialog` não expõe `duration_minutes`, `project_id`, `executive_summary` nem `agenda_type` (banco tem default `'client'` e `60`).
- `useCreateAgenda` payload não aceita esses campos — INSERT atual perde-os mesmo se preenchidos.
- `ProjectStatsData` (`src/lib/projectStatus.ts`) e RPC já retornam `meeting_hours` (banco D), mas o tipo TS não inclui — sidebar do `ProjectDetailPage` não exibe.
- Settings → Equipe (`UserManagementTab` / `UserPermissionsSheet`) não tem toggle de `bypass_client_access`. Coluna existe em `user_profiles` (banco D).

## Mudanças

### 1. `src/hooks/useMeetingAgendas.ts`
- Estender `CreateAgendaPayload` com `duration_minutes?`, `agenda_type?`, `project_id?: string | null`, `executive_summary?`.
- INSERT já é spread — basta incluir os campos.
- Adicionar hook `useProjectAgendas(projectId)` (`select id, title, meeting_date, duration_minutes` + `agenda_type='internal'` + `project_id=eq`, `staleTime 60s`, `enabled !!projectId`).

### 2. `src/components/agendas/CreateAgendaDialog.tsx`
- States novos: `agendaType` (`'client' | 'internal'`, default `'client'`), `durationMinutes` (default `60`), `projectId` (`string | null`), `executiveSummary`.
- UI:
  - Seletor "Tipo de pauta" (Cliente / Interna) — quando `internal`, **oculta** o seletor de Cliente (mas o campo `client_id` continua obrigatório no schema; nesse caso usa o cliente atual do `ClientContext` ou exige seleção). Manter Cliente sempre visível por simplicidade.
  - Campo `Duração *` ao lado da Data (grid 2 colunas), `Input type=number min=15 step=15`, helper `Xh` abaixo.
  - Quando `agendaType === 'internal'`, mostrar `Select` Projeto (busca `useProjects('tech')` + `useProjects('cx')` ou todos; usar hook existente). Opção "Nenhum projeto".
  - Campo `Resumo executivo` (`Textarea rows=3`, opcional).
- `canSubmit`: incluir `durationMinutes >= 15`.
- `handleSubmit`: passar campos novos no payload (com `project_id: agendaType === 'internal' ? projectId : null`).
- `resetForm`: resetar tudo.

### 3. `src/lib/projectStatus.ts`
- Adicionar `meeting_hours: number` em `ProjectStatsData` (opcional? — mantém obrigatório com default fallback `0` na leitura).

### 4. `src/pages/ProjectDetailPage.tsx`
- Após o card de "Tempo total", adicionar card "Reuniões":
  - Mostra apenas se `meetingHours > 0`.
  - Exibe `formatHours(meetingHours)` (ou `.toFixed(1) + 'h'`).
  - Lista até N agendas via `useProjectAgendas(id)`, clique navega para `/agendas/:id`.

### 5. Bypass TECH
- Estender `UserWithPermissions` com `bypass_client_access?: boolean` (a RPC pode ou não retornar; o frontend lê via query suplementar caso ausente).
- Para evitar mexer na RPC, adicionar `useUsersBypass()` simples: `select id, bypass_client_access from user_profiles` (admins têm RLS para ler) → Map id→bool. Mesclar no render.
- Hook novo `useUpdateUserBypass` em `src/hooks/useUserManagement.ts` (`useMutation` + `toast` + invalidar `users_with_permissions` e `users_bypass`).
- Em `UserManagementTab.tsx`, nova coluna **"Acesso TECH"** com `Switch` ao lado de Status (com tooltip), desabilitado para self.
- `UserPermissionsSheet.tsx` ganha o mesmo toggle no topo, antes da lista de clientes, com label/descrição.

### 6. Higiene
- Sem novos imports não usados (m11). Toast via `sonner` (já em uso).
- Sem `any`. Toda escrita via `useMutation` (m9).
- Sem migrations e sem editar `supabase/*`.

## Arquivos tocados
- `src/hooks/useMeetingAgendas.ts`
- `src/components/agendas/CreateAgendaDialog.tsx`
- `src/lib/projectStatus.ts`
- `src/pages/ProjectDetailPage.tsx`
- `src/hooks/useUsers.ts` (estende type)
- `src/hooks/useUserManagement.ts` (novo `useUpdateUserBypass` + helper query bypass)
- `src/components/settings/UserManagementTab.tsx`
- `src/components/settings/UserPermissionsSheet.tsx`
