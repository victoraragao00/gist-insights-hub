# CORRECAO OBRIGATORIA: unnest() em audit_alerts_summary, search_interactions, client_tone_trend_7d

Repositorio: https://github.com/HyTrackWater/gist-insights-hub
Prioridade: CRITICA — funcoes quebradas em runtime

---

## OBRIGATORIO — leia antes de qualquer acao

1. Copiar o SQL EXATAMENTE como esta neste prompt. Sem adaptacoes, sem "melhorias", sem decisoes autonomas.
2. Usar `unnest()` em toda CTE que chama `user_accessible_client_ids()` — a funcao retorna `uuid[]`, nao SETOF uuid.
3. Usar `CREATE OR REPLACE FUNCTION` para substituir as funcoes existentes.
4. Uma unica migration com as 3 funcoes corrigidas.
5. Regenerar `types.ts` apos aplicar a migration.

## PROIBIDO

1. Alterar assinatura das funcoes (parametros e return type devem ser identicos).
2. Alterar tabelas, colunas, indices ou RLS policies.
3. Alterar Edge Functions.
4. Adicionar logica nova, campos novos ou otimizacoes nao solicitadas.
5. Criar arquivos em `src/` — esta correcao e 100% SQL.
6. Remover ou modificar QUALQUER funcao que nao seja as 3 listadas abaixo.
7. Tomar decisoes autonomas sobre tipos, patterns ou alternativas. Se algo parecer errado no prompt, PARE e reporte ao Operador em vez de "resolver" por conta propria.

---

## Problema

As 3 DB functions entregues nas sessoes S3, S4 e S5 usam CTEs com `user_accessible_client_ids()` sem `unnest()`:

```sql
-- ERRADO (codigo atual):
WITH accessible AS (
  SELECT user_accessible_client_ids(p_user_id) AS cid
)
-- cid e uuid[] (1 row com array)
-- JOIN ... ON client_id = a.cid  →  uuid = uuid[]  →  QUEBRA em runtime
```

O correto e:

```sql
-- CORRETO:
WITH accessible AS (
  SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
)
-- cid e uuid (N rows com 1 uuid cada)
-- JOIN ... ON client_id = a.cid  →  uuid = uuid  →  FUNCIONA
```

Este erro nao foi detectado no deploy porque `CREATE FUNCTION` valida sintaxe, nao semantica de tipos em runtime. As funcoes vao quebrar na primeira chamada real.

---

## Migration corretiva (copiar na integra)

```sql
-- Fix: add unnest() to CTEs in audit_alerts_summary, search_interactions, client_tone_trend_7d
-- Problem: user_accessible_client_ids() returns uuid[], JOIN/WHERE requires uuid scalars

-- S3 FIX: audit_alerts_summary
CREATE OR REPLACE FUNCTION audit_alerts_summary(p_user_id uuid)
RETURNS TABLE(
  total_alerts_30d bigint,
  unread_count bigint,
  alerts jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
  ),
  recent_alerts AS (
    SELECT
      aa.id,
      c.name AS client_name,
      ar.metric,
      aa.metric_value,
      aa.message,
      aa.read,
      aa.created_at
    FROM audit_alerts aa
    JOIN accessible a ON aa.client_id = a.cid
    JOIN audit_rules ar ON aa.rule_id = ar.id
    JOIN clients c ON aa.client_id = c.id
    WHERE aa.created_at >= now() - interval '30 days'
    ORDER BY aa.created_at DESC
    LIMIT 50
  ),
  totals AS (
    SELECT
      count(*) AS total_alerts_30d,
      count(*) FILTER (WHERE NOT aa.read) AS unread_count
    FROM audit_alerts aa
    JOIN accessible a ON aa.client_id = a.cid
    WHERE aa.created_at >= now() - interval '30 days'
  )
  SELECT
    t.total_alerts_30d,
    t.unread_count,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ra.id,
        'client_name', ra.client_name,
        'metric', ra.metric,
        'metric_value', ra.metric_value,
        'message', ra.message,
        'read', ra.read,
        'created_at', ra.created_at
      )
    ) FILTER (WHERE ra.id IS NOT NULL), '[]'::jsonb) AS alerts
  FROM totals t
  LEFT JOIN recent_alerts ra ON true
  GROUP BY t.total_alerts_30d, t.unread_count;
$$;

-- S4 FIX: search_interactions
CREATE OR REPLACE FUNCTION search_interactions(
  p_user_id uuid,
  p_query text,
  p_client_id uuid DEFAULT NULL,
  p_tone text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  client_name text,
  sender_raw text,
  sender_side text,
  body text,
  tone text,
  theme text,
  occurred_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
  )
  SELECT
    i.id,
    c.name AS client_name,
    i.sender_raw,
    i.sender_side,
    i.content AS body,
    i.tone::text,
    i.theme,
    i.occurred_at,
    COUNT(*) OVER() AS total_count
  FROM interactions i
  JOIN accessible a ON i.client_id = a.cid
  JOIN clients c ON i.client_id = c.id
  WHERE i.search_vector @@ plainto_tsquery('portuguese', p_query)
    AND (p_client_id IS NULL OR i.client_id = p_client_id)
    AND (p_tone IS NULL OR i.tone::text = p_tone)
  ORDER BY ts_rank(i.search_vector, plainto_tsquery('portuguese', p_query)) DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- S5 FIX: client_tone_trend_7d
CREATE OR REPLACE FUNCTION client_tone_trend_7d(
  p_user_id uuid,
  p_client_id uuid
)
RETURNS TABLE(day date, ok bigint, atencao bigint, alerta bigint, critico bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
  ),
  days AS (
    SELECT generate_series(
      date_trunc('day', now() - interval '6 days'),
      date_trunc('day', now()),
      interval '1 day'
    ) AS day
  )
  SELECT
    d.day::date,
    COUNT(*) FILTER (WHERE i.tone = 'ok') AS ok,
    COUNT(*) FILTER (WHERE i.tone = 'atencao') AS atencao,
    COUNT(*) FILTER (WHERE i.tone = 'alerta') AS alerta,
    COUNT(*) FILTER (WHERE i.tone = 'critico') AS critico
  FROM days d
  LEFT JOIN interactions i
    ON i.client_id = p_client_id
    AND i.occurred_at >= d.day
    AND i.occurred_at < d.day + interval '1 day'
  WHERE EXISTS (SELECT 1 FROM accessible WHERE cid = p_client_id)
  GROUP BY d.day
  ORDER BY d.day;
$$;
```

---

## Verificacao pos-deploy

Apos aplicar a migration, testar as 3 funcoes no SQL Editor do Supabase:

```sql
-- Substituir pelo UUID de um admin real
SELECT * FROM audit_alerts_summary('SEU_USER_ID_AQUI');
SELECT * FROM search_interactions('SEU_USER_ID_AQUI', 'entrega');
SELECT * FROM client_tone_trend_7d('SEU_USER_ID_AQUI', 'UM_CLIENT_ID_AQUI');
```

As 3 devem retornar sem erro. Se alguma quebrar, PARE e reporte o erro exato ao Operador.

---

## Por que esta correcao existe

O prompt original das sessoes S3, S4 e S5 especificava explicitamente:

> `user_accessible_client_ids()` retorna `uuid[]` — DEVE usar `unnest()`

E na secao "SQL Patterns Obrigatorios":

> ```sql
> WITH accessible AS (
>   SELECT unnest(user_accessible_client_ids(p_user_id)) AS cid
> )
> ```

Esta instrucao foi ignorada nas 3 funcoes. O `unnest()` foi omitido, criando CTEs com 1 row de `uuid[]` em vez de N rows de `uuid`. Isso causa falha em JOINs e comparacoes `=` que esperam `uuid` escalar.

A partir desta sessao, toda instrucao marcada como OBRIGATORIO deve ser seguida literalmente. Se voce discorda de uma instrucao, reporte ao Operador ANTES de alterar. Voce nao tem autonomia para mudar decisoes tecnicas documentadas.
