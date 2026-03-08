
-- S4: search_interactions RPC + S5: client_tone_trend_7d RPC

-- S4: Full-text search on interactions
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
    SELECT user_accessible_client_ids(p_user_id) AS cid
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

-- S5: Client tone trend last 7 days
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
    SELECT user_accessible_client_ids(p_user_id) AS cid
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
