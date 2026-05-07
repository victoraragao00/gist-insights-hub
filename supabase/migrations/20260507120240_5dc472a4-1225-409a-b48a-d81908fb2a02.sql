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
  WITH
  base AS (
    SELECT d.*
    FROM demands d
    WHERE d.workspace = 'cx'
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