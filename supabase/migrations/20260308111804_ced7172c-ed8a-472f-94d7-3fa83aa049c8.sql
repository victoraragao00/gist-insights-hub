-- global_stats_30d: Returns global KPIs for Dashboard
-- Returns totals (30d), tone percentages, client count, evolution (6mo), top themes

CREATE OR REPLACE FUNCTION public.global_stats_30d(p_user_id uuid)
RETURNS TABLE (
  total_interactions_30d bigint,
  pct_critico double precision,
  pct_alerta double precision,
  total_clients_monitored bigint,
  last_calculated_at timestamptz,
  monthly_tone_evolution jsonb,
  top_themes jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH accessible AS (
  SELECT user_accessible_client_ids(p_user_id) AS cid
),
-- Last 30 days: classified interactions only
recent AS (
  SELECT i.client_id, i.tone, i.theme, i.classified_at
  FROM interactions i
  WHERE i.client_id IN (SELECT cid FROM accessible)
    AND i.classified_at IS NOT NULL
    AND i.classified_at >= now() - interval '30 days'
),
-- Totals 30d
totals AS (
  SELECT
    count(*) AS total_interactions_30d,
    count(*) FILTER (WHERE tone = 'critico') AS cnt_critico,
    count(*) FILTER (WHERE tone = 'alerta') AS cnt_alerta,
    count(DISTINCT client_id) AS total_clients_monitored
  FROM recent
),
-- Monthly evolution: last 6 months
evolution AS (
  SELECT
    date_trunc('month', i.classified_at) AS mes,
    count(*) FILTER (WHERE i.tone = 'ok') AS ok,
    count(*) FILTER (WHERE i.tone = 'atencao') AS atencao,
    count(*) FILTER (WHERE i.tone = 'alerta') AS alerta,
    count(*) FILTER (WHERE i.tone = 'critico') AS critico
  FROM interactions i
  WHERE i.client_id IN (SELECT cid FROM accessible)
    AND i.classified_at IS NOT NULL
    AND i.classified_at >= date_trunc('month', now() - interval '5 months')
  GROUP BY date_trunc('month', i.classified_at)
  ORDER BY mes
),
evolution_json AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mes', to_char(mes, 'YYYY-MM'),
        'ok', ok,
        'atencao', atencao,
        'alerta', alerta,
        'critico', critico
      ) ORDER BY mes
    ),
    '[]'::jsonb
  ) AS monthly_tone_evolution
  FROM evolution
),
-- Top 5 themes (30d)
themes AS (
  SELECT theme, count(*) AS cnt
  FROM recent
  WHERE theme IS NOT NULL AND theme != ''
  GROUP BY theme
  ORDER BY cnt DESC
  LIMIT 5
),
themes_json AS (
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('theme', theme, 'count', cnt)
      ORDER BY cnt DESC
    ),
    '[]'::jsonb
  ) AS top_themes
  FROM themes
)
SELECT
  t.total_interactions_30d,
  CASE WHEN t.total_interactions_30d > 0
    THEN (t.cnt_critico::double precision / t.total_interactions_30d * 100)
    ELSE 0
  END AS pct_critico,
  CASE WHEN t.total_interactions_30d > 0
    THEN (t.cnt_alerta::double precision / t.total_interactions_30d * 100)
    ELSE 0
  END AS pct_alerta,
  t.total_clients_monitored,
  now() AS last_calculated_at,
  e.monthly_tone_evolution,
  th.top_themes
FROM totals t
CROSS JOIN evolution_json e
CROSS JOIN themes_json th;
$$;