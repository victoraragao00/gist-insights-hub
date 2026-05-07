## Plano: SLA flexível, preservar contexto ao mover workspace, configurações de Tipos & Prioridades

### 1. SLA — colunas após "FIM SLA" também param o contador

**Problema:** hoje `get_demands_with_sla` só filtra `sla_first_response_at IS NULL`. Se o usuário pular a coluna marcada como `triggers_sla_response_at = true` e mover a demanda direto para uma coluna posterior, o SLA continua rodando.

**Solução (migration em `get_demands_with_sla`):**
- Calcular dentro da função o `position` mínimo entre as colunas onde `triggers_sla_response_at = true` (chamarei de `sla_stop_position`).
- Excluir do resultado qualquer demanda cuja coluna atual tenha `position >= sla_stop_position` **ou** que tenha `triggers_finished_at = true` / `cancellation_reason IS NOT NULL` / `sla_paused_at IS NOT NULL` (item 4).
- Nenhum filtro novo no front; `useSlaDemandsBoard` continua igual.

### 2. Encerrar SLA manualmente (mantendo no backlog)

**Migration:**
- Adicionar coluna `demands.sla_paused_at TIMESTAMPTZ NULL` + `sla_paused_by UUID NULL` + `sla_paused_reason TEXT NULL`.
- `get_demands_with_sla` ignora demandas com `sla_paused_at IS NOT NULL`.

**Frontend:**
- No `DemandSidebar.tsx`, dentro da seção SLA (ou abaixo do "Board"), adicionar botão **"Encerrar SLA"** com `AlertDialog` solicitando motivo (textarea opcional).
- Hook novo `usePauseSla` em `useDemands.ts` — atualiza os 3 campos e loga em `demand_activities` (`event_type='edited'`, descrição "SLA encerrado manualmente").
- Botão inverso **"Reativar SLA"** quando `sla_paused_at` estiver setado (limpa os 3 campos).
- Badge "SLA encerrado" no header da demanda quando pausado.

### 3. Mover workspace preservando coluna e área

Ajuste em `useChangeDemandWorkspace` (`src/hooks/useDemands.ts`):
- **Remover** o `update` em `area_id` e `column_id`. Manter apenas `{ workspace: targetWorkspace }`.
- Manter o log em `demand_activities`.
- Confirmação no `AlertDialog` do sidebar continua a mesma; só ajustar a copy ("As informações de coluna, área e responsável serão preservadas.").

> Observação: como `demand_areas` tem coluna `workspace`, uma área pode pertencer a apenas um board. Vamos preservar de qualquer forma — se a área não bater com o novo workspace, a UI do filtro de área simplesmente não a exibirá, mas o vínculo permanece intacto e visível na demanda. (Sem mudança de schema necessária.)

### 4. Configurações: Tipos e Prioridades

Criar dois novos componentes em `src/components/settings/` e plugá-los como abas (admin only) em `SettingsPage.tsx`:

**`DemandTypesSettingsTab.tsx`** (tabela `demand_types` — já existe):
- Lista (ordenada por `position`) com colunas: Nome, Cor, Ícone, Ativo.
- CRUD: criar, editar inline, ativar/desativar (soft, via `active`), reordenar via setas ↑↓ (atualiza `position`).
- Hook novo `useDemandTypesAdmin` (read/create/update). RLS `demand_types_manage` já cobre admin.

**`DemandPrioritiesSettingsTab.tsx`** (nova tabela `demand_priority_config`):
- Migration: criar `demand_priority_config (priority demand_priority PK, label TEXT, color TEXT, sla_default_hours INT, position INT, updated_at)`. Seed das 4 prioridades atuais com os labels existentes (`priorityLabel`) e cores derivadas de `priorityBadgeStyles.ts`.
- RLS: SELECT autenticados; INSERT/UPDATE/DELETE só admin (`is_admin()`).
- UI: tabela com Label, Cor (color picker), SLA padrão (horas) — bota um botão "Salvar" por linha.
- `priorityBadgeClass` / `priorityLabel` passam a ler dessa tabela via novo hook `useDemandPriorityConfig` (com fallback para os valores hardcoded atuais para não quebrar o render durante o load).

A aba existente "Prioridades" (tier de clientes) será **renomeada para "Tiers de Cliente"** para evitar confusão; a nova aba se chama "Prioridades".

### Detalhes técnicos

- **Migrations** (uma única migration para o pacote):
  1. `ALTER TABLE demands ADD COLUMN sla_paused_at TIMESTAMPTZ, sla_paused_by UUID, sla_paused_reason TEXT;`
  2. `CREATE TABLE demand_priority_config (...)` + RLS + seed.
  3. `CREATE OR REPLACE FUNCTION get_demands_with_sla(...)` com a nova lógica de `sla_stop_position` e filtro de `sla_paused_at`.
- **Frontend tocado:**
  - `src/hooks/useDemands.ts` — ajuste de `useChangeDemandWorkspace` + novos `usePauseSla` / `useResumeSla`.
  - `src/components/demands/detail/DemandSidebar.tsx` — botão Encerrar/Reativar SLA + badge.
  - `src/components/demands/detail/DemandHeader.tsx` — badge "SLA encerrado".
  - `src/pages/SettingsPage.tsx` — novas abas + renomear "Prioridades" → "Tiers de Cliente".
  - Novos: `DemandTypesSettingsTab.tsx`, `DemandPrioritiesSettingsTab.tsx`, `useDemandTypesAdmin.ts`, `useDemandPriorityConfig.ts`.
- **Sem mudanças** em `triggers_finished_at` / `triggers_sla_response_at` das colunas (o admin já configura via tab "Colunas"). Apenas a função SQL passa a respeitar `position` ao invés de exigir passagem pela coluna.
