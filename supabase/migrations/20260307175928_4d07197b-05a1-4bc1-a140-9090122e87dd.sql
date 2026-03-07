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