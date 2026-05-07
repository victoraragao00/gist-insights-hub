CREATE OR REPLACE FUNCTION public.get_tech_dashboard_metrics(p_period_days integer DEFAULT 30, p_area_id uuid DEFAULT NULL::uuid, p_project_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    UUID := auth.uid();
  v_is_admin   BOOLEAN;
  v_since      TIMESTAMPTZ := now() - (p_period_days || ' days')::INTERVAL;
  v_prev_since TIMESTAMPTZ := now() - (p_period_days * 2 || ' days')::INTERVAL;
  v_result     JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (global_role = 'admin') INTO v_is_admin
  FROM user_profiles WHERE id = v_user_id;
  v_is_admin := COALESCE(v_is_admin, false);

  WITH
  base AS (
    SELECT d.*
    FROM demands d
    WHERE d.workspace = 'tech'
      AND (p_area_id    IS NULL OR d.area_id    = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
  ),
  blocked_list AS (
    SELECT id, title, EXTRACT(DAY FROM now() - last_updated)::INT AS days
    FROM base
    WHERE is_blocked = true AND cancellation_reason IS NULL AND finished_at IS NULL
      AND EXTRACT(DAY FROM now() - last_updated) >= 3
    ORDER BY last_updated ASC
  ),
  blocked_agg AS (
    SELECT COUNT(*) AS total,
      COALESCE(json_agg(json_build_object('id',id,'title',title,'days',days)), '[]'::json) AS items
    FROM blocked_list
  ),
  wip_per_person AS (
    SELECT b.assignee_id, COUNT(*) AS wip_count
    FROM base b
    WHERE b.finished_at IS NULL AND b.cancellation_reason IS NULL AND b.assignee_id IS NOT NULL
    GROUP BY b.assignee_id
    HAVING COUNT(*) > 3
  ),
  overloaded_agg AS (
    SELECT COUNT(*) AS total,
      COALESCE(json_agg(json_build_object(
        'user_id', w.assignee_id, 'name', up.full_name, 'email', up.email, 'wip_count', w.wip_count
      ) ORDER BY w.wip_count DESC), '[]'::json) AS items
    FROM wip_per_person w
    JOIN user_profiles up ON up.id = w.assignee_id
    WHERE (v_is_admin OR w.assignee_id = v_user_id)
  ),
  forgotten_list AS (
    SELECT id, title, EXTRACT(DAY FROM now() - last_updated)::INT AS days
    FROM base
    WHERE finished_at IS NULL AND cancellation_reason IS NULL
      AND EXTRACT(DAY FROM now() - last_updated) >= 7
    ORDER BY last_updated ASC
  ),
  forgotten_agg AS (
    SELECT COUNT(*) AS total,
      COALESCE(json_agg(json_build_object('id',id,'title',title,'days',days)), '[]'::json) AS items
    FROM forgotten_list
  ),
  delivered_current AS (
    SELECT COUNT(*) AS cnt FROM base WHERE finished_at >= v_since AND cancellation_reason IS NULL
  ),
  delivered_previous AS (
    SELECT COUNT(*) AS cnt FROM base
    WHERE finished_at >= v_prev_since AND finished_at < v_since AND cancellation_reason IS NULL
  ),
  delivered_by_area AS (
    SELECT COALESCE(da.name, 'Sem area') AS area_name, COUNT(*) AS cnt
    FROM base b
    LEFT JOIN demand_areas da ON da.id = b.area_id
    WHERE b.finished_at >= v_since AND b.cancellation_reason IS NULL
    GROUP BY da.name
  ),
  delivered_area_json AS (
    SELECT COALESCE(json_agg(json_build_object('area_name', area_name, 'count', cnt)), '[]'::json) AS items
    FROM delivered_by_area
  ),
  weeks AS (
    SELECT generate_series(date_trunc('week', v_since), date_trunc('week', now()), '1 week'::INTERVAL) AS week_start
  ),
  done_per_week AS (
    SELECT date_trunc('week', finished_at) AS week_start, COUNT(*) AS done
    FROM base
    WHERE finished_at IS NOT NULL AND cancellation_reason IS NULL
      AND finished_at >= date_trunc('week', v_since)
    GROUP BY 1
  ),
  created_per_week AS (
    SELECT date_trunc('week', created_at) AS week_start, COUNT(*) AS created
    FROM base WHERE created_at >= date_trunc('week', v_since)
    GROUP BY 1
  ),
  throughput_raw AS (
    SELECT w.week_start, to_char(w.week_start, 'DD/MM') AS week_label,
      COALESCE(dp.done, 0) AS done, COALESCE(cp.created, 0) AS created
    FROM weeks w
    LEFT JOIN done_per_week    dp ON dp.week_start = w.week_start
    LEFT JOIN created_per_week cp ON cp.week_start = w.week_start
  ),
  throughput_agg AS (
    SELECT
      COALESCE(json_agg(json_build_object('week_label', week_label, 'done', done, 'created', created) ORDER BY week_start), '[]'::json) AS data,
      SUM(created) AS total_created,
      SUM(done)    AS total_done
    FROM throughput_raw
  ),
  cycle_raw AS (
    SELECT GREATEST(EXTRACT(EPOCH FROM (finished_at - created_at))/86400.0, 0) AS cycle_days
    FROM base
    WHERE finished_at IS NOT NULL AND cancellation_reason IS NULL AND finished_at >= v_since
  ),
  cycle_p50 AS (SELECT PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY cycle_days) AS val FROM cycle_raw),
  cycle_p85 AS (SELECT PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_days) AS val FROM cycle_raw),
  cycle_avg AS (SELECT ROUND(AVG(cycle_days)::NUMERIC, 1) AS val FROM cycle_raw),
  cycle_dist_raw AS (
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
    SELECT COALESCE(json_agg(json_build_object('bucket', bucket, 'count', cnt)), '[]'::json) AS data
    FROM cycle_dist_raw
  ),
  moves AS (
    SELECT da.demand_id, da.created_at, da.to_value,
      LEAD(da.created_at) OVER (PARTITION BY da.demand_id ORDER BY da.created_at) AS next_at
    FROM demand_activities da
    JOIN base d ON d.id = da.demand_id
    WHERE da.event_type = 'moved' AND da.created_at >= v_since
      AND da.to_value ~* '^[0-9a-f-]{36}$'
  ),
  col_time_raw AS (
    SELECT tc.id AS column_id, tc.name AS column_name, tc.position,
      ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(m.next_at, now()) - m.created_at))/86400.0)::NUMERIC, 1) AS avg_days,
      ROUND(PERCENTILE_CONT(0.85) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (COALESCE(m.next_at, now()) - m.created_at))/86400.0
      )::NUMERIC, 1) AS p85_days
    FROM moves m
    JOIN ticket_columns tc ON tc.id = m.to_value::UUID
    GROUP BY tc.id, tc.name, tc.position
  ),
  col_time_agg AS (
    SELECT COALESCE(json_agg(json_build_object('column_id', column_id, 'column_name', column_name, 'avg_days', avg_days, 'p85_days', p85_days) ORDER BY position), '[]'::json) AS data
    FROM col_time_raw
  ),
  person_wip AS (
    SELECT assignee_id, COUNT(*) AS cnt FROM base
    WHERE finished_at IS NULL AND cancellation_reason IS NULL AND assignee_id IS NOT NULL
    GROUP BY assignee_id
  ),
  person_hours AS (
    SELECT dte.user_id,
      ROUND(COALESCE(SUM(
        CASE WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
             WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at))/3600.0
             ELSE 0 END
      ), 0)::NUMERIC, 1) AS total
    FROM demand_time_entries dte
    JOIN base d ON d.id = dte.demand_id
    WHERE dte.created_at >= v_since
    GROUP BY dte.user_id
  ),
  person_delivered AS (
    SELECT assignee_id, COUNT(*) AS cnt FROM base
    WHERE finished_at >= v_since AND cancellation_reason IS NULL AND assignee_id IS NOT NULL
    GROUP BY assignee_id
  ),
  people_agg AS (
    SELECT COALESCE(json_agg(json_build_object(
      'user_id', up.id, 'name', up.full_name, 'email', up.email,
      'wip_count', COALESCE(pw.cnt, 0),
      'hours_period', COALESCE(ph.total, 0),
      'delivered_period', COALESCE(pd.cnt, 0)
    ) ORDER BY COALESCE(pw.cnt, 0) DESC), '[]'::json) AS data
    FROM user_profiles up
    LEFT JOIN person_wip       pw ON pw.assignee_id = up.id
    LEFT JOIN person_hours     ph ON ph.user_id     = up.id
    LEFT JOIN person_delivered pd ON pd.assignee_id = up.id
    WHERE (COALESCE(pw.cnt, 0) > 0 OR COALESCE(ph.total, 0) > 0 OR COALESCE(pd.cnt, 0) > 0)
      AND (v_is_admin OR up.id = v_user_id)
  ),
  weekly_done AS (
    SELECT date_trunc('week', finished_at) AS wk, COUNT(*) AS done FROM base
    WHERE finished_at >= v_since AND cancellation_reason IS NULL
    GROUP BY 1
  ),
  backlog_count AS (
    SELECT COUNT(*) AS cnt FROM base WHERE finished_at IS NULL AND cancellation_reason IS NULL
  ),
  forecast_p75 AS (SELECT GREATEST(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY done), 1) AS val FROM weekly_done),
  forecast_p50 AS (SELECT GREATEST(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY done), 1) AS val FROM weekly_done),
  forecast_p25 AS (SELECT GREATEST(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY done), 1) AS val FROM weekly_done),
  forecast_avg AS (SELECT ROUND(AVG(done)::NUMERIC, 1) AS val FROM weekly_done),
  hours_global AS (
    SELECT
      ROUND(COALESCE((
        SELECT SUM(dt.hours_estimated)
        FROM demand_tasks dt JOIN base b ON b.id = dt.demand_id
      ), 0)::NUMERIC, 1) AS estimated,
      ROUND(COALESCE((
        SELECT SUM(
          CASE WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
               WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at))/3600.0
               ELSE 0 END
        )
        FROM demand_time_entries dte JOIN base b ON b.id = dte.demand_id
        WHERE dte.created_at >= v_since
      ), 0)::NUMERIC, 1) AS actual
  ),
  hours_by_area_raw AS (
    SELECT da.id AS area_id, da.name AS area_name,
      ROUND(COALESCE((
        SELECT SUM(dt.hours_estimated)
        FROM demand_tasks dt JOIN base b ON b.id = dt.demand_id
        WHERE b.area_id = da.id
      ), 0)::NUMERIC, 1) AS estimated,
      ROUND(COALESCE((
        SELECT SUM(
          CASE WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
               WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at))/3600.0
               ELSE 0 END
        )
        FROM demand_time_entries dte JOIN base b ON b.id = dte.demand_id
        WHERE b.area_id = da.id AND dte.created_at >= v_since
      ), 0)::NUMERIC, 1) AS actual
    FROM demand_areas da
    WHERE p_area_id IS NULL OR da.id = p_area_id
  ),
  hours_area_agg AS (
    SELECT COALESCE(json_agg(json_build_object(
      'area_id', area_id, 'area_name', area_name, 'estimated', estimated, 'actual', actual
    )) FILTER (WHERE estimated > 0 OR actual > 0), '[]'::json) AS data
    FROM hours_by_area_raw
  )
  SELECT json_build_object(
    'period_days',  p_period_days,
    'generated_at', now(),
    'is_admin',     v_is_admin,
    'alerts', json_build_object(
      'blocked',    json_build_object('count', (SELECT total FROM blocked_agg),    'items', (SELECT items FROM blocked_agg)),
      'overloaded', json_build_object('count', (SELECT total FROM overloaded_agg), 'items', (SELECT items FROM overloaded_agg)),
      'forgotten',  json_build_object('count', (SELECT total FROM forgotten_agg),  'items', (SELECT items FROM forgotten_agg)),
      'delivered',  json_build_object(
        'count_current',  (SELECT cnt FROM delivered_current),
        'count_previous', (SELECT cnt FROM delivered_previous),
        'by_area',        (SELECT items FROM delivered_area_json)
      )
    ),
    'throughput', json_build_object(
      'weekly',        (SELECT data FROM throughput_agg),
      'total_done',    (SELECT total_done FROM throughput_agg),
      'total_created', (SELECT total_created FROM throughput_agg),
      'delivery_rate', CASE
        WHEN COALESCE((SELECT total_created FROM throughput_agg), 0) > 0
        THEN ROUND(((SELECT total_done FROM throughput_agg)::NUMERIC /
                    (SELECT total_created FROM throughput_agg)) * 100, 1)
        ELSE 0 END
    ),
    'cycle_time', json_build_object(
      'p50_cycle',    ROUND((SELECT val FROM cycle_p50)::NUMERIC, 1),
      'p85_cycle',    ROUND((SELECT val FROM cycle_p85)::NUMERIC, 1),
      'avg_lead',     (SELECT val FROM cycle_avg),
      'distribution', (SELECT data FROM cycle_dist_agg),
      'reopen_count', 0
    ),
    'column_time', (SELECT data FROM col_time_agg),
    'people',      (SELECT data FROM people_agg),
    'forecast', json_build_object(
      'backlog_count',      (SELECT cnt FROM backlog_count),
      'avg_throughput',     (SELECT val FROM forecast_avg),
      'weeks_optimist',     ROUND(((SELECT cnt FROM backlog_count)::NUMERIC / (SELECT val FROM forecast_p75))::NUMERIC, 1),
      'weeks_probable',     ROUND(((SELECT cnt FROM backlog_count)::NUMERIC / (SELECT val FROM forecast_p50))::NUMERIC, 1),
      'weeks_conservative', ROUND(((SELECT cnt FROM backlog_count)::NUMERIC / (SELECT val FROM forecast_p25))::NUMERIC, 1)
    ),
    'hours', json_build_object(
      'total_estimated', (SELECT estimated FROM hours_global),
      'total_actual',    (SELECT actual    FROM hours_global),
      'by_area',         (SELECT data      FROM hours_area_agg)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;