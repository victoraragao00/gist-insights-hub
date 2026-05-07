# LOVABLE HOTFIX — CTX1: `get_cx_analytics_metrics` SECURITY DEFINER sem RLS

> **Tipo:** Hotfix de segurança · **Severidade:** CRÍTICA · **Bloqueador para produção**
> **Origem:** Auditoria Claude Code do burst 2026-04-09→2026-05-07 — `auditorias/AUDITORIA_20260507.md` item CTX1
> **Pendência:** `auditorias/PENDENTES.md` linha CTX1

---

## Cabeçalho

| Campo | Valor |
|---|---|
| **Repositório** | https://github.com/HyTrackWater/gist-insights-hub |
| **Prioridade** | 🚨 CRÍTICA — corrigir antes de qualquer feature nova |
| **Dependências** | Nenhuma. A função `is_admin()` e a coluna `user_profiles.bypass_client_access` já existem no banco. |
| **Aplicar via** | Lovable migration tool (gera nova migration SQL no `supabase/migrations/`) |

---

## Problema

A função `get_cx_analytics_metrics(p_period_days, p_client_id)` é `SECURITY DEFINER`. O CTE `base` lê `demands` direto:

```sql
base AS (
  SELECT d.*
  FROM demands d
  WHERE d.workspace = 'cx'
    AND (p_client_id IS NULL OR d.client_id = p_client_id)
)
```

**Não há filtro `user_accessible_client_ids(auth.uid())`**. Quando `p_client_id IS NULL`, qualquer authenticated user — mesmo um viewer com acesso a 1 cliente — recebe analytics CX (throughput, cycle time, pessoas, distribuição) de **todos os clientes** do workspace CX. Vazamento cross-cliente real.

Comparação: `get_demand_analytics(p_client_id, p_days)` da Fase 7.3 recebe `client_id` obrigatório e protege via call-site/RLS. Aqui não há essa proteção.

**Atual:** `supabase/migrations/20260507120240_5dc472a4-1225-409a-b48a-d81908fb2a02.sql`

---

## OBRIGATÓRIO

1. Criar nova migration que faz `CREATE OR REPLACE FUNCTION public.get_cx_analytics_metrics(...)` exatamente com o SQL abaixo (seção "SQL").
2. Manter assinatura idêntica: `(p_period_days INT DEFAULT 30, p_client_id UUID DEFAULT NULL) RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public`.
3. Manter o nome do CTE `base` e o restante do corpo IGUAL — mudar apenas o `WHERE` de `base` para incluir o filtro RLS.
4. Adicionar `COMMENT ON FUNCTION` documentando que a função filtra por `user_accessible_client_ids(auth.uid())` e que admins (incluindo `bypass_client_access=true`) recebem todos os clientes ativos.
5. Rodar as queries de Verificação abaixo após deploy e colar os resultados na thread.

## PROIBIDO

1. **Não** alterar o tipo de retorno (JSON), a assinatura, o nome da função ou o `SECURITY DEFINER`.
2. **Não** alterar qualquer outra função (`get_demand_analytics`, `get_tech_dashboard_metrics`, `user_accessible_client_ids`, `is_admin`).
3. **Não** simplificar/refatorar a query — risco de quebrar o frontend (`useCxAnalytics.ts`) que depende do shape exato do JSON retornado.
4. **Não** alterar `useCxAnalytics.ts` ou qualquer arquivo do frontend nesta migration. Frontend já está correto.
5. **Não** alterar `src/integrations/supabase/types.ts`.
6. **Não** remover a coluna `reopen_count` do JSON (frontend espera, mesmo hardcoded como 0 — `useCxAnalytics` adiciona client-side).

---

## SQL (copiar na íntegra para a migration)

```sql
-- Hotfix CTX1: get_cx_analytics_metrics agora filtra por user_accessible_client_ids
-- Antes: SECURITY DEFINER lia demands cross-cliente quando p_client_id IS NULL.
-- Agora: CTE `base` filtra explicitamente por client_id IN (SELECT * FROM user_accessible_client_ids(auth.uid())).
-- Admins (global_role='admin' OU bypass_client_access=true) recebem todos os clients ativos via user_accessible_client_ids.

CREATE OR REPLACE FUNCTION public.get_cx_analytics_metrics(
  p_period_days INT  DEFAULT 30,
  p_client_id   UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - (p_period_days || ' days')::INTERVAL;
  v_result JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH
  base AS (
    SELECT d.*
    FROM demands d
    WHERE d.workspace = 'cx'
      AND d.client_id IN (SELECT * FROM public.user_accessible_client_ids(auth.uid()))
      AND (p_client_id IS NULL OR d.client_id = p_client_id)
  ),
  weeks AS (
    SELECT generate_series(
      date_trunc('week', v_since),
      date_trunc('week', now()),
      '1 week'::INTERVAL
    ) AS week_start
  ),
  throughput AS (
    SELECT
      to_char(w.week_start, 'DD/MM') AS week_label,
      w.week_start,
      COUNT(DISTINCT done_d.id) AS done,
      COUNT(DISTINCT new_d.id) AS created
    FROM weeks w
    LEFT JOIN base done_d ON done_d.finished_at >= w.week_start
      AND done_d.finished_at < w.week_start + '1 week'::INTERVAL
      AND done_d.cancellation_reason IS NULL
    LEFT JOIN base new_d ON new_d.created_at >= w.week_start
      AND new_d.created_at < w.week_start + '1 week'::INTERVAL
    GROUP BY w.week_start, week_label
    ORDER BY w.week_start
  ),
  throughput_agg AS (
    SELECT COALESCE(json_agg(json_build_object(
      'week_label', week_label, 'done', done, 'created', created
    ) ORDER BY week_start), '[]') AS data,
    SUM(done) AS total_done, NULLIF(SUM(created), 0) AS total_created
    FROM throughput
  ),
  cycle_raw AS (
    SELECT GREATEST(EXTRACT(EPOCH FROM (finished_at - created_at))/86400.0, 0) AS cycle_days
    FROM base
    WHERE finished_at IS NOT NULL
      AND cancellation_reason IS NULL
      AND finished_at >= v_since
  ),
  cycle_p50 AS (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_days) AS val FROM cycle_raw),
  cycle_p85 AS (SELECT PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_days) AS val FROM cycle_raw),
  cycle_avg AS (SELECT ROUND(AVG(cycle_days)::NUMERIC, 1) AS val FROM cycle_raw),
  cycle_dist AS (
    SELECT
      CASE
        WHEN cycle_days <= 2  THEN '1-2d'
        WHEN cycle_days <= 5  THEN '3-5d'
        WHEN cycle_days <= 10 THEN '6-10d'
        WHEN cycle_days <= 15 THEN '11-15d'
        WHEN cycle_days <= 21 THEN '16-21d'
        ELSE '22d+'
      END AS bucket,
      COUNT(*) AS cnt
    FROM cycle_raw GROUP BY bucket
  ),
  cycle_dist_agg AS (
    SELECT COALESCE(json_agg(json_build_object('bucket', bucket, 'count', cnt)), '[]') AS data
    FROM cycle_dist
  ),
  col_time AS (
    SELECT
      tc.id AS column_id, tc.name AS column_name, tc.position,
      ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(d.finished_at, now()) - d.started_at))/86400.0)::NUMERIC, 1) AS avg_days,
      ROUND(PERCENTILE_CONT(0.85) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (COALESCE(d.finished_at, now()) - d.started_at))/86400.0
      )::NUMERIC, 1) AS p85_days
    FROM base d
    JOIN ticket_columns tc ON tc.id = d.column_id
    WHERE d.started_at IS NOT NULL
    GROUP BY tc.id, tc.name, tc.position
  ),
  col_time_agg AS (
    SELECT COALESCE(json_agg(json_build_object(
      'column_id', column_id, 'column_name', column_name,
      'avg_days', avg_days, 'p85_days', p85_days
    ) ORDER BY position), '[]') AS data
    FROM col_time
  ),
  person_wip AS (
    SELECT assignee_id, COUNT(*) AS wip_count
    FROM base WHERE finished_at IS NULL AND cancellation_reason IS NULL AND assignee_id IS NOT NULL
    GROUP BY assignee_id
  ),
  person_delivered AS (
    SELECT assignee_id, COUNT(*) AS cnt
    FROM base WHERE finished_at >= v_since AND cancellation_reason IS NULL AND assignee_id IS NOT NULL
    GROUP BY assignee_id
  ),
  people_agg AS (
    SELECT COALESCE(json_agg(json_build_object(
      'user_id',          up.id,
      'name',             up.full_name,
      'email',            up.email,
      'wip_count',        COALESCE(pw.wip_count, 0),
      'delivered_period', COALESCE(pd.cnt, 0)
    ) ORDER BY COALESCE(pw.wip_count, 0) DESC), '[]') AS data
    FROM user_profiles up
    LEFT JOIN person_wip pw ON pw.assignee_id = up.id
    LEFT JOIN person_delivered pd ON pd.assignee_id = up.id
    WHERE COALESCE(pw.wip_count, 0) > 0 OR COALESCE(pd.cnt, 0) > 0
  )
  SELECT json_build_object(
    'period_days', p_period_days,
    'throughput', json_build_object(
      'weekly',        (SELECT data FROM throughput_agg),
      'total_done',    (SELECT total_done FROM throughput_agg),
      'total_created', (SELECT total_created FROM throughput_agg),
      'delivery_rate', CASE
        WHEN (SELECT total_created FROM throughput_agg) > 0
        THEN ROUND(((SELECT total_done FROM throughput_agg)::NUMERIC /
                    (SELECT total_created FROM throughput_agg)) * 100, 1)
        ELSE 0 END
    ),
    'cycle_time', json_build_object(
      'p50_cycle',    ROUND((SELECT val FROM cycle_p50)::NUMERIC, 1),
      'p85_cycle',    ROUND((SELECT val FROM cycle_p85)::NUMERIC, 1),
      'avg_lead',     (SELECT val FROM cycle_avg),
      'distribution', (SELECT data FROM cycle_dist_agg)
    ),
    'column_time', (SELECT data FROM col_time_agg),
    'people',      (SELECT data FROM people_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_cx_analytics_metrics IS
  'CX Analytics — throughput, cycle time, tempo por coluna, pessoas. SECURITY DEFINER mas filtra demands via user_accessible_client_ids(auth.uid()) — admins (global_role=admin OR bypass_client_access=true) recebem todos clientes ativos; outros usuarios recebem somente seus clients via user_client_access.';
```

---

## Verificação (rodar APÓS deploy)

Rodar no Supabase SQL Editor logado como cada perfil de usuário e colar o resultado na thread.

### 1. Smoke test (qualquer user autenticado)

```sql
SELECT public.get_cx_analytics_metrics(30, NULL);
```

**Esperado:** retorna JSON com chaves `period_days`, `throughput`, `cycle_time`, `column_time`, `people`. Sem erro de RLS.

### 2. Validar isolamento (user viewer com acesso a 1 cliente)

```sql
-- Pegar um user viewer com acesso a apenas 1 cliente
SELECT u.id AS user_id, u.email,
       (SELECT COUNT(*) FROM user_client_access WHERE user_id = u.id) AS clients_count,
       up.global_role, up.bypass_client_access
FROM auth.users u
JOIN user_profiles up ON up.id = u.id
WHERE up.global_role != 'admin'
  AND COALESCE(up.bypass_client_access, false) = false
LIMIT 5;

-- Em seguida, logar com esse user no Supabase Dashboard e rodar:
-- SELECT public.get_cx_analytics_metrics(30, NULL);
-- Conferir que `total_done` e `total_created` representam APENAS o(s) cliente(s) acessivel(is).
```

### 3. Validar admin recebe todos

```sql
-- Logado como admin (global_role='admin'), comparar:
SELECT
  (SELECT COUNT(*) FROM demands WHERE workspace='cx' AND finished_at >= now() - interval '30 days' AND cancellation_reason IS NULL) AS total_real,
  ((public.get_cx_analytics_metrics(30, NULL)->'throughput'->>'total_done')::INT) AS total_returned;
-- Esperado: total_real == total_returned
```

### 4. Validar `p_client_id` específico ainda funciona

```sql
SELECT public.get_cx_analytics_metrics(30, '<UUID-de-cliente-acessivel>');
-- Esperado: JSON com dados desse cliente.

SELECT public.get_cx_analytics_metrics(30, '<UUID-de-cliente-NAO-acessivel>');
-- Esperado: JSON vazio (zeros) — base CTE filtra fora.
```

### 5. Confirmar que outras funções não foram afetadas

```sql
-- get_demand_analytics deve continuar funcionando exatamente igual
SELECT public.get_demand_analytics('<UUID-cliente>', 30);

-- get_tech_dashboard_metrics não foi tocado nesta hotfix (CTX2 separado)
SELECT public.get_tech_dashboard_metrics(30, NULL, NULL);
```

---

## Rollback (se algo der errado)

A migration anterior (`20260507120240_5dc472a4-1225-409a-b48a-d81908fb2a02.sql`) tem o corpo original. Para reverter, criar nova migration que aplica `CREATE OR REPLACE FUNCTION` com aquele corpo. **Atenção:** o estado pré-fix tinha o vazamento — só reverter se o fix introduzir bug funcional.

---

## Notas

- A função `user_accessible_client_ids(_user_id UUID)` retorna `SETOF UUID`. Usar `IN (SELECT * FROM user_accessible_client_ids(auth.uid()))` (com `SELECT *`), conforme padrão registrado em AGENTS.md §1 SQL Patterns.
- O frontend (`src/hooks/useCxAnalytics.ts`) **não muda** — o shape do JSON é idêntico.
- Esta hotfix **NÃO** resolve CTX2 (Tech Dashboard). Ver prompt separado se/quando ratificar a decisão de produto sobre TECH ser interno.
