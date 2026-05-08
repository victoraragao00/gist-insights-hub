## Escopo confirmado

Seis ajustes em Projetos/Demandas/RFIs.

---

## 1. RFI vinculada a Demanda OU Projeto (XOR)

Migration em `rfis`:
- `ALTER COLUMN demand_id DROP NOT NULL`
- `DROP CONSTRAINT rfis_demand_id_key` (UNIQUE)
- `ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE`
- `ADD CONSTRAINT rfis_xor CHECK ((demand_id IS NOT NULL) <> (project_id IS NOT NULL))` — exatamente um.
- Índice `idx_rfis_project_id`.
- Atualizar RLS para também permitir acesso quando `project_id` aponta para projeto cujo `client_id` está em `user_accessible_client_ids` (ou é projeto interno acessível).

Frontend:
- `useRfis.ts`: aceitar `project_id`; novo hook `useProjectRfis(projectId)`.
- `RfiDetailSheet`: mostra "Vinculado a: Demanda X" ou "Projeto Y" (apenas leitura do vínculo — definido na criação).
- `CreateRfiDialog`: recebe contexto (`{ demandId }` ou `{ projectId }`) e bloqueia o outro campo.
- Nova aba **RFIs** em `ProjectDetailPage` com botão "Nova RFI" pré-vinculada ao projeto.
- `RFIsPage` (lista global): coluna "Vinculado a" mostrando Demanda X ou Projeto Y.

## 2. Filtro multi-pessoa no Kanban de Demandas

- `useDemands.ts`: trocar `assignee_id?: string` por `assignee_ids?: string[]` em `DemandFilters`; query usa `.in("assignee_id", ids)`.
- `DemandsPage.tsx`: novo `MultiAssigneeFilter` baseado em `Combobox` com checkboxes (memória: Combobox para listas grandes). Mantém atalho "Minhas".
- Persistir em `localStorage` (`demands:assignees`).
- Atualizar `useExportDemandsCSV` para aceitar a nova shape.

## 3. Datas previstas e reais em Projetos

Migration em `projects`:
- `ADD COLUMN planned_start_date date`
- `ADD COLUMN planned_end_date date`
- `ADD COLUMN actual_start_date date`
- `ADD COLUMN actual_end_date date`
- Backfill: `planned_end_date := due_date`, `planned_start_date := created_at::date`.
- Manter `due_date` por compat (sincronizado com `planned_end_date` via trigger ou via app).

Frontend:
- Sidebar de `ProjectDetailPage`: 4 campos editáveis (Início previsto, Fim previsto, Início real, Fim real) com `Calendar` + Popover.
- `useUpdateProject`: aceitar os 4 campos.
- `ProjectCard`: mostrar range previsto.

## 4. Histórico de movimentações de datas (apenas Projetos nesta fase)

Nova tabela `project_date_changes`:
- `id`, `project_id` (FK CASCADE), `field text` (`planned_start|planned_end|actual_start|actual_end`), `old_value date`, `new_value date`, `changed_by uuid REFERENCES user_profiles(id)`, `changed_at timestamptz default now()`, `note text`.
- RLS leitura: quem vê o projeto vê o histórico.
- Trigger `BEFORE UPDATE` em `projects`: para cada uma das 4 colunas alteradas, insere row em `project_date_changes` com `auth.uid()`.
- Hook `useProjectDateHistory(projectId)`.
- Nova aba **Histórico** em `ProjectDetailPage`: timeline ordenada `desc` no formato "Fulano alterou Fim Previsto: DD/MM/AAAA → DD/MM/AAAA".

Demandas e RFIs ficam para fase posterior.

## 5. Visualização em calendário de Projetos

- `ProjectsPage.tsx`: toggle Lista | Agrupado | **Calendário**, persistido em `localStorage` (`projects:viewMode`).
- Sub-toggle dentro do calendário: **Previsto / Real** (`projects:calendarMode`).
  - Previsto usa `planned_start_date` → `planned_end_date`.
  - Real usa `actual_start_date` → `actual_end_date` (projetos sem essas datas não aparecem em modo Real).
- Componente `ProjectsCalendarView`: vista mensal estilo Gantt do print.
  - Header: dias do mês.
  - Linhas: um projeto por linha, agrupado por owner (similar ao print, com header colapsável).
  - Barras horizontais coloridas por status, com título; click navega para o detalhe.
  - Navegação mês anterior / mês atual / próximo mês.
- Filtros (status, owner, cliente) compartilhados com a vista de lista.

---

## Arquivos afetados

Migrations:
- `..._rfi_project_link_xor.sql`
- `..._project_planned_actual_dates.sql`
- `..._project_date_history.sql`

Hooks:
- `src/hooks/useRfis.ts`, `src/hooks/useDemands.ts`, `src/hooks/useProjects.ts`, `src/hooks/useExportDemandsCSV.ts`
- novos: `useProjectRfis.ts`, `useProjectDateHistory.ts`

Componentes / páginas:
- `src/pages/DemandsPage.tsx` + novo `src/components/demands/MultiAssigneeFilter.tsx`
- `src/pages/ProjectsPage.tsx` + novo `src/components/projects/ProjectsCalendarView.tsx`
- `src/pages/ProjectDetailPage.tsx` (4 campos de data + abas RFIs e Histórico)
- `src/components/projects/tabs/ProjectRfisTab.tsx`
- `src/components/projects/tabs/ProjectDateHistoryTab.tsx`
- `src/components/rfis/RfiDetailSheet.tsx`, `src/pages/RFIsPage.tsx`