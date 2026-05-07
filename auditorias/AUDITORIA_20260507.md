# Auditoria — Burst de 2026-04-09 a 2026-05-07

**Data:** 2026-05-07
**Auditor:** Claude Code
**Escopo:** 526 commits desde CONTEXT.md v29 (último: `65b49c7` — 2026-04-09).
**Artefatos auditados:**
- 30 migrações SQL (`supabase/migrations/`)
- 6 páginas novas (`src/pages/`)
- 13 hooks novos (`src/hooks/`)
- 14 edge functions modificadas + 1 nova (`test-classify`)

**Contra:** Checklist CTO m1–m13, Anti-padrões PRD/AGENTS.md §5–6, SQL Patterns AGENTS.md §1, Design System.

---

## Sumário executivo

| Severidade | Qtd | Resolução |
|---|---|---|
| Crítico | 4 | 1 já corrigido (histórico) — 3 abertos |
| Alto    | 4 | 0 corrigidos |
| Médio   | 11 | 0 corrigidos |
| Baixo   | 18 | 0 corrigidos |

**Frentes auditadas (10):**
1. Classifier Prompt Config (2026-04-14)
2. Limpeza histórica <2026-01-01 (2026-04-20)
3. SLA fix posicional (2026-05-04)
4. Time Tracking — `demand_time_entries` (2026-05-04)
5. `deactivate_stale_clients` (2026-05-04)
6. Workspaces — `default_workspace`/`workspace`/`agenda_type`/`source_demand_id` (2026-05-05)
7. Projetos — `projects`/`project_members`/RPCs (2026-05-05/07)
8. Demand Tasks + Collaborators + Block History (2026-05-05)
9. Tech Dashboard + CX Analytics + Demand Relationships (2026-05-05/07)
10. Edge Functions — test-classify nova + 14 migrações Gemini direto (2026-04 a 05)

---

## Críticos

### CTX1 — `get_cx_analytics_metrics` sem RLS por usuário ⛔

**Arquivo:** `supabase/migrations/20260507120240_5dc472a4-1225-409a-b48a-d81908fb2a02.sql`
**Risco:** Vazamento cross-cliente.

A função é `SECURITY DEFINER`. CTE `base AS (SELECT * FROM demands WHERE workspace='cx' AND (p_client_id IS NULL OR client_id = p_client_id))` **não filtra `user_accessible_client_ids(auth.uid())`**. Qualquer authenticated user que chame com `p_client_id = NULL` vê analytics CX de **todos os clientes** — throughput, cycle time, pessoas, etc. — incluindo dados de clientes aos quais não tem acesso explícito.

Comparar com `get_demand_analytics(p_client_id, p_days)` (Fase 7.3): recebe `client_id` obrigatório e protege via call-site/RLS.

**Recomendação:** Adicionar no início da função:
```sql
IF NOT EXISTS (
  SELECT 1 FROM user_profiles
  WHERE id = auth.uid() AND (global_role = 'admin' OR bypass_client_access = true)
) AND p_client_id IS NULL THEN
  RAISE EXCEPTION 'p_client_id required for non-admin users';
END IF;

-- E filtrar `base`:
base AS (
  SELECT d.* FROM demands d
  WHERE d.workspace = 'cx'
    AND d.client_id IN (SELECT * FROM user_accessible_client_ids(auth.uid()))
    AND (p_client_id IS NULL OR d.client_id = p_client_id)
)
```

### CTX2 — `get_tech_dashboard_metrics` sem RLS por usuário ⚠

**Arquivo:** `supabase/migrations/20260507114714_6c7756d7-6c7e-4ec9-9b4a-49f216628547.sql` (v3, 305 linhas)

Mesma estrutura do CTX1: `base AS (SELECT * FROM demands WHERE workspace='tech' ...)` sem filtro RLS. Defensável **se** a regra de produto for "Tech é workspace interno uMode, todos do time TECH veem tudo". Mas:
- Não há flag `is_tech_member` em user_profiles que justifique o acesso
- Qualquer viewer com acesso a 1 cliente vê o dashboard tech inteiro
- Não há documentação dessa decisão

**Recomendação:** OU documentar formalmente em CONTEXT.md como decisão de produto + adicionar guard `IF NOT (is_admin() OR bypass_client_access OR EXISTS tech_member) THEN RAISE`, OU aplicar mesmo filtro do CTX1.

### CTX3 — `user_accessible_client_ids` reescrita sem trail ⚠

**Arquivo:** `supabase/migrations/20260505215732_3ad4b254-cd86-41aa-a8f2-5ae80c822923.sql`

A função core de RLS — usada em **todas** as policies de demands, demand_tasks, time_entries, collaborators, block_history, etc. — teve sua semântica alterada. Antes: admin via `global_role='admin'`. Agora: admin OR `bypass_client_access=true` (nova coluna `user_profiles.bypass_client_access`).

Problemas:
- Não há comentário SQL explicando a motivação
- Não há referência em CONTEXT.md v29
- `UNION ALL` (não `UNION`) pode duplicar client_ids se admin também tiver registros em `user_client_access`

**Recomendação:**
1. Documentar em CONTEXT.md v30 quem decidiu, quando e por quê
2. Trocar `UNION ALL` por `UNION` (defensive)
3. Auditar se existe algum user com `bypass_client_access = true` que não deveria

### CTX4 — DELETE histórico sem filtro `auto_created` 🟡 (já executado — não é reversível)

**Arquivo:** `supabase/migrations/20260420211903_ee53fb06-de61-4087-bbe6-2d3a42ae67f4.sql`

```sql
DELETE FROM public.interactions WHERE occurred_at < '2026-01-01T00:00:00Z';
```

Viola princípio inviolável do PRD/AGENTS.md §6: *"UPDATE/DELETE filtra `metadata->>'auto_created' = 'true'`"*. Mesmo sendo decisão de produto consciente (cleanup de histórico não-analítico que estava reabastecendo fila Gemini), faltou:
- O filtro como guard de cinto-e-suspensórios (mesmo que retornasse 0 linhas filtradas)
- Backup/export prévio
- Trail de aprovação (quem decidiu o cutoff em 2026-01-01)
- Comentário SQL explicando *por que* o filtro foi omitido

**Resolução:** Já executado, irreversível. **Lição:** instituir convenção em todas migrações destrutivas — se não usar `auto_created`, **comentar explicitamente o motivo no header da migração**.

---

## Altos

### CTX5 — Janela de 1h em 2026-05-05 com `projects_insert WITH CHECK (true)` 🟡 (já corrigido)

**Arquivos:** entre `20260505133227` (cria policy `WITH CHECK (true)`) e `20260505134758` (corrige para `auth.uid() = owner_id`).

Durante ~1h, qualquer authenticated user podia inserir project com **qualquer `owner_id`**. Mitigado pela migração 134758 (mesmo dia). Em prod com 1 operador (Victor), exposição mínima — mas é vulnerabilidade real para o histórico.

**Recomendação:** Usar a migração 134758 como referência. Para mudanças de RLS, evitar estados intermediários permissivos — preferir nova policy primeiro, depois drop antiga.

### CTX6 — `deactivate_stale_clients` SECURITY DEFINER sem `is_admin()` guard

**Arquivo:** `20260504131751_cd355042-a614-49a8-95e3-db0107e59d99.sql`

Função `SECURITY DEFINER` desativa clientes em massa (ainda que filtrando `auto_created='true'` + sem demandas/agendas). Sem `GRANT ... TO admin` explícito ou `IF NOT is_admin() THEN RAISE`, qualquer authenticated user pode invocar via `supabase.rpc("deactivate_stale_clients", { _days: 1 })` e desativar centenas de clientes.

**Recomendação:**
```sql
CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  -- ... resto do corpo
END;
$$;
```

### CTX7 — Mudança silenciosa de contrato de `projects.workspace`

**Arquivo:** `20260507113359_d75b9443-0bf2-413f-87aa-d72dc7bf398a.sql`

Comentário da coluna mudou de "Workspace de origem (cx ou tech), determina onde aparece" para "Apenas informativo — projetos são visíveis em ambos os workspaces". Comportamento da policy SELECT também mudou (não filtra mais por workspace). **Nenhum aviso aos consumers do API**. Hooks que esperavam `workspace='cx'` filtrar dão resultado diferente agora.

**Recomendação:** Documentar a mudança em CONTEXT.md v30 sob nota explícita de "breaking-change de contrato". Verificar se algum hook depende do filtro antigo (revisar `useProjects("cx")` e similares).

### CTX8 — Backfill `is_internal=true WHERE client_id IS NULL` pode ter falsos positivos

**Arquivo:** `20260507113359_...`

```sql
UPDATE projects SET is_internal = true WHERE client_id IS NULL AND is_internal = false;
```

Projetos sem cliente associado **antes** da introdução de `is_internal` viram automaticamente "internos". Mas pode haver projetos rascunho/transição que ficaram sem cliente por outras razões (ex: cliente removido).

**Recomendação:** Listar projetos onde `is_internal=true` e `created_at < '2026-05-07'` e validar manualmente com Victor.

---

## Médios

### CTX9 — `client_id IN (SELECT user_accessible_client_ids(auth.uid()))` em RLS de 7 tabelas

**Arquivos:** `demand_time_entries`, `demand_tasks`, `demand_collaborators`, `demand_block_history`, `demand_relationships`, `time_entries`/policies — todas as RLS novas.

Pattern usa SRF (set-returning function) dentro de scalar subquery sem alias. Funciona em PG mas é frágil — semântica subtilmente diferente de `IN (SELECT * FROM user_accessible_client_ids(auth.uid()))`. AGENTS.md §1 SQL Patterns documenta o padrão preferido.

**Recomendação:** Padronizar em `IN (SELECT * FROM user_accessible_client_ids(auth.uid()))`. Migração de cleanup com `DROP POLICY` + `CREATE POLICY` para cada uma.

### CTX10 — `meeting_agendas.project_id` sem CHECK constraint

**Arquivo:** `20260505215732_...`

Comment promete: *"Apenas pautas com agenda_type=internal podem ter project_id"*. Não há CHECK constraint forçando isso. INSERT direto via REST com `agenda_type='client'` + `project_id=...` viola contrato silenciosamente.

**Recomendação:**
```sql
ALTER TABLE meeting_agendas
  ADD CONSTRAINT chk_project_only_internal
  CHECK (project_id IS NULL OR agenda_type = 'internal');
```

### CTX11 — `auto_unblock_dependent_demands` usa `LIKE` em texto livre

**Arquivo:** `20260507115132_f3783125-45f1-4532-8926-7ed863c26ca2.sql`

```sql
WHERE dep.blocker_reason LIKE 'Aguardando conclusão de:%'
```

Identifica blocos criados pelo trigger via string-matching. Fragilidades:
- Se admin edita `blocker_reason` manualmente, perde-se o link
- I18n futura quebra
- Operador pode digitar a frase manualmente sem usar o sistema, e o trigger desbloqueia indevidamente

**Recomendação:** Adicionar coluna `blocked_by_relationship_id UUID REFERENCES demand_relationships(id) ON DELETE SET NULL` em `demands` e usar isso como fonte de verdade.

### CTX12 — `useCreateProject` faz 2 queries (race condition)

**Arquivo:** `src/hooks/useProjects.ts:270-301`

```ts
const { data: created } = await supabase.rpc("create_project", { ... });
if (input.is_internal && newId) {
  await supabase.from("projects").update({ is_internal: true }).eq("id", newId);
}
```

RPC `create_project` não aceita `p_is_internal`. Frontend precisa fazer 2 calls. Janela onde outros users veem projeto interno como `is_internal=false`.

**Recomendação:** Adicionar `p_is_internal BOOLEAN DEFAULT false` ao RPC e definir tudo numa transação.

### CTX13 — `projects_update` permite mudar `owner_id`

**Arquivo:** `20260505132732_...`

```sql
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
```

Owner pode transferir posse para outro user via UPDATE. Não há validação de que isso é desejado (transferência deveria ser fluxo explícito).

**Recomendação:** Adicionar trigger `BEFORE UPDATE` que rejeita mudança de `owner_id` exceto via RPC dedicado `transfer_project_ownership(p_project_id, p_new_owner_id)`.

### CTX14 — Casts `as unknown as` em hooks novos (m1)

**Arquivo:** `src/hooks/useProjects.ts` (8 ocorrências), `useTechDashboard.ts` (1), `useCxAnalytics.ts` (1).

Pattern histórico já documentado em PENDENTES (M1a). Continua replicando em código novo.

**Recomendação:** Após próxima regen de `src/integrations/supabase/types.ts`, revisitar. JOINs aninhados são o caso justificado; cast em `data as TipoX` direto é evitável.

### CTX15 — `block_history` sem UPDATE policy (intencional?)

**Arquivo:** `20260505215732_...`

Trigger `track_demand_block_history` faz `UPDATE` direto via SECURITY DEFINER. Sem RLS UPDATE policy explícita, intenção é "só trigger pode atualizar". Funciona mas não está documentado.

**Recomendação:** Adicionar comment SQL: `COMMENT ON TABLE demand_block_history IS '... UPDATE/DELETE só via trigger track_demand_block_history (sem RLS write policy)'`.

### CTX16 — `cancel_project` exclui admin global

**Arquivo:** `20260505104942_...`

Apenas owner pode cancelar. Admin global não pode — inconsistente com outras tabelas onde admin tem bypass.

**Recomendação:**
```sql
IF v_owner_id != auth.uid() AND NOT is_admin() THEN
  RAISE EXCEPTION 'Apenas o owner ou admin pode cancelar';
END IF;
```

### CTX17 — `LIMIT 1` sem `ORDER BY` em busca de columns por trigger

**Arquivos:** `mark_sla_first_response` (20260504103858), `check_demand_auto_complete` (20260505130616).

```sql
SELECT id INTO v_finish_column_id
  FROM ticket_columns WHERE triggers_finished_at = true LIMIT 1;
```

Se houver +1 coluna com `triggers_finished_at = true`, comportamento não-determinístico.

**Recomendação:** Adicionar partial unique indexes:
```sql
CREATE UNIQUE INDEX uq_ticket_columns_finish ON ticket_columns(id) WHERE triggers_finished_at = true;
CREATE UNIQUE INDEX uq_ticket_columns_start  ON ticket_columns(id) WHERE triggers_started_at  = true;
CREATE UNIQUE INDEX uq_ticket_columns_sla    ON ticket_columns(id) WHERE triggers_sla_response_at = true;
```

### CTX18 — `ALLOWED_ORIGIN ?? "*"` em todas as edge functions auditadas

**Arquivos:** `test-classify`, `analyze-demand`, `summarize-conversation`, `process-jobs`, `evaluate-audit-rules`.

Fallback para wildcard CORS se env var faltar em prod. Risco operacional (se config drift apaga a var).

**Recomendação:** Em cada function, validar no boot:
```ts
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN");
if (!ALLOWED_ORIGIN) {
  throw new Error("ALLOWED_ORIGIN must be set in env");
}
```

### CTX19 — `get_*` SECURITY DEFINER sem check de acesso à demand

**Arquivos:** `get_demand_total_hours`, `get_demand_task_stats`, `get_demand_block_metrics`, `get_demand_relationships`.

Todas SECURITY DEFINER, todas SELECT-only, **sem verificar** se o user tem acesso à demand. Vazam métricas agregadas (somatório de horas, contagem de tasks, etc.).

**Recomendação:** Adicionar guard inicial:
```sql
IF NOT EXISTS (
  SELECT 1 FROM demands d
  WHERE d.id = p_demand_id
    AND d.client_id IN (SELECT * FROM user_accessible_client_ids(auth.uid()))
) THEN
  RAISE EXCEPTION 'Access denied';
END IF;
```

---

## Baixos

### CTX20 — RLS de `blocker_types` e `squads` (efêmero) usa `EXISTS user_profiles WHERE global_role='admin'` em vez do helper `is_admin()`

Inconsistência de pattern — Victor estabeleceu `is_admin()` como helper canônico em 2026-03-31 (CONTEXT v29 item 27). Squads não existe mais, mas blocker_types sim (4 policies).

### CTX21 — Inconsistência entre `deactivate_stale_clients` e cleanup manual de 2026-05-04

Migração usa `active = false`. Cleanup manual usou `status = 'inativo'` + `active = false` + flag `cleanup_2026_05_inactivated`. Documentar qual é o pattern oficial.

### CTX22 — `classification_prompt_config.created_by` aponta `auth.users(id)` direto

Resto do projeto usa `user_profiles(id)`. Inconsistência.

### CTX23 — Heurística `LOWER(name) LIKE '%opera%'` para classificar áreas como CX

Frágil — clientes com nome "Operação Customer" ficam fora.

### CTX24 — `get_tech_dashboard_metrics` viola "Funções concisas" (Playbook)

305 linhas em uma única PL/pgSQL. Anti-padrão "código monolítico". Trade-off: query consolidada evita N+1.

### CTX25 — TODO no schema: `demand_event_type` não tem `'reopened'`

Comentário em `get_tech_dashboard_metrics` admite. `reopen_count` está hardcoded como 0. Cria expectativa no frontend que nunca é satisfeita.

### CTX26 — `da.to_value ~* '^[0-9a-f-]{36}$'` regex frouxo para UUID

Aceita "------" (36 hyphens). Cast direto `m.to_value::UUID` é mais rigoroso (já é feito no JOIN downstream — o regex é redundante).

### CTX27 — `valid_themes jsonb` em `classification_prompt_config` sem CHECK de schema

JSONB pode armazenar qualquer coisa. Validação só no app.

### CTX28 — `get_demand_total_hours` SECURITY DEFINER sem `STABLE` em uma versão

Verificar versão atual. Versão de 20260504112758 declarava STABLE. Versão de 20260505155614 também. OK na verdade — só `LANGUAGE SQL STABLE`. Confirmado.

### CTX29 — `default_workspace` UPDATE redundante após ALTER

```sql
ALTER TABLE user_profiles ADD COLUMN ... NOT NULL DEFAULT 'cx';
UPDATE user_profiles SET default_workspace = 'cx' WHERE default_workspace IS NULL;
```

Coluna já tem `NOT NULL DEFAULT` — UPDATE nunca pega nada. Dead code (inofensivo).

### CTX30 — `demand_tasks` triggers sem `SECURITY DEFINER`

`update_demand_tasks_updated_at` e `set_demand_task_dates` não declaram SECURITY DEFINER. Como `BEFORE UPDATE` no próprio row, funciona — mas inconsistente com outros triggers do projeto.

### CTX31 — Imports no meio do arquivo

`src/pages/ProjectsPage.tsx:72` — `import { useProjectStats, type ProjectRow } from "@/hooks/useProjects"` no MEIO do arquivo, depois da function default export.

### CTX32 — N×`useProjectStats` em paralelo no `ProjectsPage`

Filtro client-side requer 1 query por projeto. Para 50+ projetos, escala mal.

### CTX33 — `useTechDashboard.useEffect(() => toast.error(...), [error])`

Pode disparar múltiplas vezes em re-renders (se `error` muda referência). Pattern OK mas não defensivo.

### CTX34 — `q.ilike("title", "%${query.trim()}%")` sem escape de wildcards

User pode digitar `%` para ver tudo. Não é SQL injection (Supabase escapa). Aceitável.

### CTX35 — `deactivate_stale_clients`: cast `(metadata->>'last_seen_at')::timestamptz` em coluna não-indexada

Scan completo. Aceitável dado volume baixo (~16 clients ativos).

### CTX36 — `get_tech_dashboard_metrics` usa `EXTRACT(DAY FROM now() - last_updated)` em vez de `now() - last_updated > interval '3 days'`

Estilo. Funciona corretamente.

### CTX37 — `get_demand_relationships`, `get_demand_block_metrics` retornam JSON sem schema TS validado

Frontend declara tipo `as unknown as ...` sem runtime check.

---

## Pontos positivos (notáveis)

- **Recursão RLS detectada e corrigida** via `is_project_accessible()` SECURITY DEFINER (mig `20260505132334`). Comment explica o porquê.
- **Squads foi experimentado e revertido com `DROP CASCADE` no mesmo dia** (`20260505114746`) — disciplina excelente em corrigir rapidamente decisão errada.
- **CHECK constraint elegante** em `demand_time_entries` para 3 estados válidos (timer ativo / timer fechado / hora manual).
- **Partial unique index** `uq_time_entries_one_active_per_user WHERE ended_at IS NULL` — pattern certo para "no máximo 1 ativo por user".
- **`set_demand_task_dates` BEFORE UPDATE OF status** — eficiente e correto (limpa `finished_at` se reaberto).
- **`check_demand_auto_complete`** — quando todas as tasks ficam done, fecha demand pai automaticamente, com guards `cancellation_reason IS NULL AND finished_at IS NULL`.
- **`test-classify` Edge Function nova** — JWT real, admin check, multiple prompt sources, JSON parse com recovery, Gemini primary + Claude fallback. Excelente.
- **`is_distinct_from`** em trigger `track_demand_block_history` — NULL-safe corretamente.

---

## Recomendação executiva

**Bloqueadores:** CTX1 (CX vazamento) e CTX6 (deactivate_stale_clients sem guard) — ambos exploitables por qualquer authenticated user. Subir issue urgente para Lovable.

**Esta semana:** CTX2/CTX3 (decisões de RLS sem documentação), CTX10 (CHECK em meeting_agendas), CTX12 (race condition useCreateProject).

**Próximo sprint:** CTX9, CTX11, CTX13, CTX17, CTX19 — pattern fixes que afetam múltiplas tabelas/funções.

**Lições para próxima migração:**
1. RLS em SECURITY DEFINER **deve filtrar por user_accessible_client_ids quando lê demands cross-cliente** — vide CTX1 e CTX2.
2. Para mudanças destrutivas em massa (DELETE/UPDATE), incluir comentário SQL no header explicando *por que* o filtro `auto_created` foi omitido — vide CTX4.
3. Para SECURITY DEFINER que muta dados, primeiro statement do corpo deve ser `IF NOT is_admin() THEN RAISE` (a menos que decisão consciente em contrário) — vide CTX6.
4. Mudanças em policies RLS: nova policy permissiva → nova restritiva → drop antiga — nunca uma janela com `WITH CHECK (true)` — vide CTX5.

---

**Próximos passos do auditor:**
- ✅ Atualizar `auditorias/PENDENTES.md` com violações novas
- ✅ Redigir `CONTEXT.md` v30 com Fases 7.7+ documentadas e pendências mapeadas
- ⏳ Aguardar João decidir prioridade dos bloqueadores
