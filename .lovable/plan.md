

# Fix: Clientes com interações zeradas na tela /clients

## Causa raiz

A query de interações dos últimos 30 dias tem `.limit(200)` (linha 190). Com dezenas de clientes e centenas/milhares de interações, apenas 200 rows são retornadas. Clientes cujas interações não caem nesse corte aparecem zerados.

## Solução

Trocar a abordagem de "buscar todas as interações e computar no front" por uma **query agregada no banco**, que retorna já os stats por client_id. Isso elimina o problema de limite e é muito mais eficiente.

### Mudanças em `src/pages/ClientsPage.tsx`

1. **Substituir a query de interações** por uma query que usa `supabase.rpc()` chamando uma nova função SQL, ou por uma query com agrupamento manual via duas queries menores:

   - Query 1: contagem + tom + last_contact por client_id (usando a view do banco)
   - Alternativa mais simples: aumentar o limit para 5000 e paginar se necessário

2. **Abordagem escolhida — função SQL `client_stats_30d`**: criar uma função SQL SECURITY DEFINER que retorna `(client_id, total_30d, dominant_tone, health_pct, last_contact)` já agregados, respeitando RLS via `user_accessible_client_ids`.

### Nova migration SQL

```sql
CREATE OR REPLACE FUNCTION public.client_stats_30d(_user_id uuid)
RETURNS TABLE(
  client_id uuid,
  total_30d bigint,
  dominant_tone text,
  health_pct integer,
  last_contact timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  WITH accessible AS (
    SELECT user_accessible_client_ids(_user_id) AS cid
  ),
  recent AS (
    SELECT i.client_id, i.tone, i.occurred_at
    FROM interactions i
    WHERE i.client_id IN (SELECT cid FROM accessible)
      AND i.occurred_at >= now() - interval '30 days'
  ),
  agg AS (
    SELECT
      r.client_id,
      count(*) AS total_30d,
      count(*) FILTER (WHERE r.tone IS DISTINCT FROM 'ok') AS non_ok,
      max(r.occurred_at) AS last_contact
    FROM recent r
    GROUP BY r.client_id
  ),
  tone_ranked AS (
    SELECT
      r.client_id,
      r.tone,
      ROW_NUMBER() OVER (
        PARTITION BY r.client_id
        ORDER BY count(*) DESC
      ) AS rn
    FROM recent r
    WHERE r.tone IS DISTINCT FROM 'ok'
    GROUP BY r.client_id, r.tone
  )
  SELECT
    a.client_id,
    a.total_30d,
    COALESCE(t.tone, 'ok')::text AS dominant_tone,
    CASE WHEN a.total_30d > 0
      THEN (a.non_ok * 100 / a.total_30d)::integer
      ELSE 0
    END AS health_pct,
    a.last_contact
  FROM agg a
  LEFT JOIN tone_ranked t ON t.client_id = a.client_id AND t.rn = 1;
$$;
```

### Mudanças no front

- Remover a query `interactions_30d_all` e a função `computeStats`
- Substituir por `supabase.rpc('client_stats_30d', { _user_id: user.id })` 
- Mapear o resultado diretamente no `clientsWithStats`, fazendo join por `client_id`
- Clientes sem stats (sem interações) mantêm os defaults (0, "ok", 0%, null)

### Benefícios

- Sem limite de rows — a agregação roda no banco
- Performance muito melhor (retorna 1 row por client em vez de milhares de interactions)
- Mesma lógica de RLS preservada via `user_accessible_client_ids`

