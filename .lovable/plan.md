## Contexto

Esta sprint **revisa a arquitetura** do Sprint 3-A anterior. Em vez de manter tabelas dedicadas `squads` / `squad_members` + coluna `demands.squad_id`, vamos usar a tabela existente `demand_areas` (já vinculada via `demands.area_id`) como definição das raias do swimlane TECH, controlada por uma nova coluna `workspace`.

Estado atual no banco (verificado):
- `demands.workspace` **já existe** (criado no 3-A) — backfill já feito
- `demands.squad_id` existe — precisa ser removido
- Tabelas `squads` e `squad_members` existem — precisam ser removidas
- `demand_areas.workspace` **não existe** — precisa ser criado
- Frontend tem `useSquads.ts`, `SquadsSettingsTab.tsx`, lógica de squad em `TechSwimlanePage`, `CreateDemandDialog`, `DemandSidebar` — precisa ser refatorado

---

## Plano

### 1. Migration de banco (única, executa tudo na ordem)

```sql
-- A. Garantir demands.workspace (idempotente, já existe)
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'cx'
  CHECK (workspace IN ('cx','tech'));
UPDATE demands SET workspace = 'cx' WHERE workspace IS NULL;
CREATE INDEX IF NOT EXISTS idx_demands_workspace ON demands(workspace);
COMMENT ON COLUMN demands.workspace IS '...';

-- B. demand_areas.workspace (NOVO)
ALTER TABLE demand_areas
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'both'
  CHECK (workspace IN ('cx','tech','both'));

UPDATE demand_areas
SET workspace = CASE
  WHEN LOWER(name) LIKE '%opera%' THEN 'cx'
  ELSE 'tech'
END;

CREATE INDEX IF NOT EXISTS idx_demand_areas_workspace
  ON demand_areas(workspace) WHERE active = true;
COMMENT ON COLUMN demand_areas.workspace IS '...';

-- C. Cleanup do 3-A (squads)
DROP INDEX IF EXISTS idx_demands_squad;
ALTER TABLE demands DROP COLUMN IF EXISTS squad_id;
DROP TABLE IF EXISTS squad_members CASCADE;
DROP TABLE IF EXISTS squads CASCADE;
```

### 2. Refatoração frontend (raias = áreas com `workspace IN ('tech','both')`)

**Remover:**
- `src/hooks/useSquads.ts`
- `src/components/settings/SquadsSettingsTab.tsx`
- Aba "Squads" em `src/pages/SettingsPage.tsx`

**Atualizar `src/hooks/useDemandAreas.ts`:**
- Adicionar campo `workspace` no tipo
- Adicionar `useAreasByWorkspace(ws)` retornando áreas ativas filtradas por workspace (`tech`/`cx`/`both`)
- `useManageAreas` aceitar `workspace` em add/update

**Atualizar `src/components/demands/AreaSettingsTab.tsx`:**
- Coluna/seletor de workspace por área (cx | tech | both) com badge
- Filtro/agrupamento por workspace

**Atualizar `src/components/demands/TechSwimlanePage.tsx`:**
- Trocar todas as referências de `squad`/`squad_id` por `area`/`area_id`
- Raias = áreas com workspace tech/both + raia "Sem área" no fim
- DnD vertical chama `useUpdateDemand({ area_id })` em vez de `useUpdateDemandSquad`
- DroppableId continua `${areaId}::${columnId}`

**Atualizar `src/hooks/useDemands.ts`:**
- Remover filtro `squad_id` do `DemandFilters` e da query
- Remover `squad_id` do payload de `useCreateDemand`

**Atualizar `src/components/demands/CreateDemandDialog.tsx`:**
- Remover seleção de Squad
- Quando `workspace === 'tech'`, pré-selecionar Área filtrando por `useAreasByWorkspace('tech')` (auto-default na primeira área tech disponível, opcional)
- Sempre enviar `workspace` ativo

**Atualizar `src/components/demands/detail/DemandSidebar.tsx`:**
- Remover linha "Squad"
- Linha "Área" já existente passa a ser o controle único (já filtrar opções por workspace da demanda)

### 3. Verificação pós-deploy
Queries do prompt + smoke test: `/demands` em workspace TECH deve renderizar swimlane com áreas como raias; criação de demanda em TECH grava `workspace='tech'` + `area_id` da área tech.

---

## Observações

- A migration é idempotente — segura mesmo se 3-A já estava parcialmente aplicado.
- Toda a lógica de "membros do squad" (avatares na raia) deixa de existir nesta arquitetura. Se a UI atual da swimlane mostra avatares por squad, eles serão removidos — raias passam a ter apenas nome + cor da área.
- Aprovado o plano, executo migration + refactor de uma vez.