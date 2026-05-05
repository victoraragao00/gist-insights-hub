
CREATE OR REPLACE FUNCTION public.get_tech_dashboard_metrics(
  p_period_days INT  DEFAULT 30,
  p_area_id     UUID DEFAULT NULL,
  p_project_id  UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_is_admin   BOOLEAN;
  v_since      TIMESTAMPTZ := now() - (p_period_days || ' days')::INTERVAL;
  v_prev_since TIMESTAMPTZ := now() - (p_period_days * 2 || ' days')::INTERVAL;

  v_alerts      JSON;
  v_throughput  JSON;
  v_cycle_time  JSON;
  v_column_time JSON;
  v_people      JSON;
  v_forecast    JSON;
  v_hours       JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT global_role = 'admin' INTO v_is_admin
  FROM user_profiles WHERE id = v_user_id;
  v_is_admin := COALESCE(v_is_admin, false);

  -- ── 1. ALERTAS ────────────────────────────────────────────────
  SELECT json_build_object(
    'blocked', (
      SELECT json_build_object(
        'count', COUNT(*),
        'items', COALESCE(json_agg(json_build_object(
          'id',    d.id,
          'title', d.title,
          'days',  EXTRACT(DAY FROM now() - d.last_updated)::INT
        ) ORDER BY d.last_updated ASC), '[]'::json)
      )
      FROM demands d
      WHERE d.workspace = 'tech'
        AND d.is_blocked = true
        AND d.cancellation_reason IS NULL
        AND d.finished_at IS NULL
        AND EXTRACT(DAY FROM now() - d.last_updated) >= 3
        AND (p_area_id IS NULL OR d.area_id = p_area_id)
        AND (p_project_id IS NULL OR d.project_id = p_project_id)
    ),
    'overloaded', (
      WITH wip AS (
        SELECT d.assignee_id, COUNT(*) AS wip_count
        FROM demands d
        WHERE d.workspace = 'tech'
          AND d.finished_at IS NULL
          AND d.cancellation_reason IS NULL
          AND d.assignee_id IS NOT NULL
          AND (p_area_id IS NULL OR d.area_id = p_area_id)
        GROUP BY d.assignee_id
        HAVING COUNT(*) > 3
      )
      SELECT json_build_object(
        'count', COUNT(*),
        'items', COALESCE(json_agg(json_build_object(
          'user_id',   w.assignee_id,
          'name',      up.full_name,
          'email',     up.email,
          'wip_count', w.wip_count
        ) ORDER BY w.wip_count DESC), '[]'::json)
      )
      FROM wip w
      JOIN user_profiles up ON up.id = w.assignee_id
      WHERE (v_is_admin OR w.assignee_id = v_user_id)
    ),
    'forgotten', (
      SELECT json_build_object(
        'count', COUNT(*),
        'items', COALESCE(json_agg(json_build_object(
          'id',    d.id,
          'title', d.title,
          'days',  EXTRACT(DAY FROM now() - d.last_updated)::INT
        ) ORDER BY d.last_updated ASC), '[]'::json)
      )
      FROM demands d
      WHERE d.workspace = 'tech'
        AND d.finished_at IS NULL
        AND d.cancellation_reason IS NULL
        AND EXTRACT(DAY FROM now() - d.last_updated) >= 7
        AND (p_area_id IS NULL OR d.area_id = p_area_id)
        AND (p_project_id IS NULL OR d.project_id = p_project_id)
    ),
    'delivered', (
      SELECT json_build_object(
        'count_current',  COUNT(*) FILTER (WHERE d.finished_at >= v_since),
        'count_previous', COUNT(*) FILTER (WHERE d.finished_at >= v_prev_since AND d.finished_at < v_since),
        'by_area', (
          SELECT COALESCE(json_agg(json_build_object('area', COALESCE(da.name, 'Sem area'), 'count', x.ac)), '[]'::json)
          FROM (
            SELECT d2.area_id, COUNT(*) ac
            FROM demands d2
            WHERE d2.workspace = 'tech'
              AND d2.finished_at >= v_since
              AND d2.cancellation_reason IS NULL
              AND (p_area_id IS NULL OR d2.area_id = p_area_id)
              AND (p_project_id IS NULL OR d2.project_id = p_project_id)
            GROUP BY d2.area_id
          ) x
          LEFT JOIN demand_areas da ON da.id = x.area_id
        )
      )
      FROM demands d
      WHERE d.workspace = 'tech'
        AND d.finished_at IS NOT NULL
        AND d.cancellation_reason IS NULL
        AND d.finished_at >= v_prev_since
        AND (p_area_id IS NULL OR d.area_id = p_area_id)
        AND (p_project_id IS NULL OR d.project_id = p_project_id)
    )
  ) INTO v_alerts;

  -- ── 2. THROUGHPUT SEMANAL ─────────────────────────────────────
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', v_since),
      date_trunc('week', now()),
      '1 week'::INTERVAL
    ) AS week_start
  ),
  done_per_week AS (
    SELECT date_trunc('week', d.finished_at) AS week_start, COUNT(*) AS done
    FROM demands d
    WHERE d.workspace = 'tech'
      AND d.cancellation_reason IS NULL
      AND d.finished_at IS NOT NULL
      AND d.finished_at >= date_trunc('week', v_since)
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
    GROUP BY 1
  ),
  created_per_week AS (
    SELECT date_trunc('week', d.created_at) AS week_start, COUNT(*) AS created
    FROM demands d
    WHERE d.workspace = 'tech'
      AND d.created_at >= date_trunc('week', v_since)
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
    GROUP BY 1
  )
  SELECT json_agg(json_build_object(
    'week_label', to_char(w.week_start, 'DD/MM'),
    'week_start', w.week_start,
    'done',       COALESCE(dp.done, 0),
    'created',    COALESCE(cp.created, 0)
  ) ORDER BY w.week_start) INTO v_throughput
  FROM weeks w
  LEFT JOIN done_per_week    dp ON dp.week_start = w.week_start
  LEFT JOIN created_per_week cp ON cp.week_start = w.week_start;

  -- ── 3. CYCLE TIME ─────────────────────────────────────────────
  WITH cycle_data AS (
    SELECT
      EXTRACT(EPOCH FROM (d.finished_at - d.created_at))/86400.0 AS cycle_days,
      EXTRACT(EPOCH FROM (d.finished_at - COALESCE(d.started_at, d.created_at)))/86400.0 AS work_days
    FROM demands d
    WHERE d.workspace = 'tech'
      AND d.finished_at IS NOT NULL
      AND d.cancellation_reason IS NULL
      AND d.finished_at >= v_since
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
  )
  SELECT json_build_object(
    'p50_cycle', PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY cycle_days),
    'p85_cycle', PERCENTILE_CONT(0.85) WITHIN GROUP (ORDER BY cycle_days),
    'avg_lead',  AVG(cycle_days),
    'p50_work',  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY work_days),
    'distribution', (
      SELECT COALESCE(json_agg(json_build_object('bucket', bucket, 'count', cnt) ORDER BY min_days), '[]'::json)
      FROM (
        SELECT
          CASE
            WHEN cycle_days <= 2  THEN '1-2d'
            WHEN cycle_days <= 5  THEN '3-5d'
            WHEN cycle_days <= 10 THEN '6-10d'
            WHEN cycle_days <= 15 THEN '11-15d'
            WHEN cycle_days <= 21 THEN '16-21d'
            ELSE '22d+'
          END AS bucket,
          COUNT(*) AS cnt,
          MIN(cycle_days) AS min_days
        FROM cycle_data
        GROUP BY bucket
      ) buckets
    )
  ) INTO v_cycle_time
  FROM cycle_data;

  -- ── 4. TEMPO MÉDIO POR COLUNA ─────────────────────────────────
  -- Usa eventos 'moved' do demand_activities; duração entre evento e o próximo.
  -- Assume to_value contém UUID da coluna destino (formato gravado pelos triggers atuais).
  WITH moves AS (
    SELECT
      da.demand_id,
      da.created_at,
      da.to_value,
      LEAD(da.created_at) OVER (PARTITION BY da.demand_id ORDER BY da.created_at) AS next_at
    FROM demand_activities da
    JOIN demands d ON d.id = da.demand_id
    WHERE da.event_type = 'moved'
      AND da.created_at >= v_since
      AND d.workspace = 'tech'
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
      AND da.to_value ~* '^[0-9a-f-]{36}$'
  )
  SELECT json_agg(json_build_object(
    'column_id',   tc.id,
    'column_name', tc.name,
    'avg_days',    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(m.next_at, now()) - m.created_at))/86400.0)::NUMERIC, 1)
  ) ORDER BY tc.position) INTO v_column_time
  FROM moves m
  JOIN ticket_columns tc ON tc.id = m.to_value::UUID
  GROUP BY tc.id, tc.name, tc.position;

  -- ── 5. CARGA POR PESSOA ───────────────────────────────────────
  WITH wip_q AS (
    SELECT assignee_id, COUNT(*) cnt
    FROM demands
    WHERE workspace = 'tech'
      AND finished_at IS NULL
      AND cancellation_reason IS NULL
      AND assignee_id IS NOT NULL
      AND (p_area_id IS NULL OR area_id = p_area_id)
      AND (p_project_id IS NULL OR project_id = p_project_id)
    GROUP BY assignee_id
  ),
  hours_q AS (
    SELECT dte.user_id, COALESCE(SUM(
      CASE WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
           WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at))/3600.0
           ELSE 0 END
    ), 0) AS total
    FROM demand_time_entries dte
    JOIN demands d ON d.id = dte.demand_id
    WHERE d.workspace = 'tech'
      AND dte.created_at >= v_since
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
    GROUP BY dte.user_id
  ),
  delivered_q AS (
    SELECT assignee_id, COUNT(*) cnt
    FROM demands
    WHERE workspace = 'tech'
      AND finished_at >= v_since
      AND cancellation_reason IS NULL
      AND assignee_id IS NOT NULL
      AND (p_area_id IS NULL OR area_id = p_area_id)
      AND (p_project_id IS NULL OR project_id = p_project_id)
    GROUP BY assignee_id
  )
  SELECT json_agg(json_build_object(
    'user_id',          up.id,
    'name',             up.full_name,
    'email',            up.email,
    'wip_count',        COALESCE(wip_q.cnt, 0),
    'hours_period',     COALESCE(hours_q.total, 0),
    'delivered_period', COALESCE(delivered_q.cnt, 0)
  ) ORDER BY COALESCE(wip_q.cnt, 0) DESC NULLS LAST) INTO v_people
  FROM user_profiles up
  LEFT JOIN wip_q       ON wip_q.assignee_id       = up.id
  LEFT JOIN hours_q     ON hours_q.user_id         = up.id
  LEFT JOIN delivered_q ON delivered_q.assignee_id = up.id
  WHERE (COALESCE(wip_q.cnt, 0) > 0 OR COALESCE(hours_q.total, 0) > 0 OR COALESCE(delivered_q.cnt, 0) > 0)
    AND (v_is_admin OR up.id = v_user_id);

  -- ── 6. FORECAST ───────────────────────────────────────────────
  WITH weekly_throughput AS (
    SELECT date_trunc('week', finished_at) AS week, COUNT(*) AS done
    FROM demands
    WHERE workspace = 'tech'
      AND finished_at >= v_since
      AND cancellation_reason IS NULL
      AND (p_area_id IS NULL OR area_id = p_area_id)
      AND (p_project_id IS NULL OR project_id = p_project_id)
    GROUP BY 1
  ),
  backlog AS (
    SELECT COUNT(*) AS cnt
    FROM demands
    WHERE workspace = 'tech'
      AND finished_at IS NULL
      AND cancellation_reason IS NULL
      AND (p_area_id IS NULL OR area_id = p_area_id)
      AND (p_project_id IS NULL OR project_id = p_project_id)
  )
  SELECT json_build_object(
    'backlog_count',      (SELECT cnt FROM backlog),
    'avg_throughput',     ROUND(AVG(done)::NUMERIC, 1),
    'p75_throughput',     PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY done),
    'p50_throughput',     PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY done),
    'p25_throughput',     PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY done),
    'weeks_optimist',     ROUND(((SELECT cnt FROM backlog) / NULLIF(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY done), 0))::NUMERIC, 1),
    'weeks_probable',     ROUND(((SELECT cnt FROM backlog) / NULLIF(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY done), 0))::NUMERIC, 1),
    'weeks_conservative', ROUND(((SELECT cnt FROM backlog) / NULLIF(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY done), 0))::NUMERIC, 1)
  ) INTO v_forecast
  FROM weekly_throughput;

  -- ── 7. HORAS INVESTIDAS VS ESTIMADAS ──────────────────────────
  WITH est AS (
    SELECT COALESCE(SUM(dt.hours_estimated), 0) AS total_estimated
    FROM demand_tasks dt
    JOIN demands d ON d.id = dt.demand_id
    WHERE d.workspace = 'tech'
      AND d.created_at >= v_since
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
  ),
  act AS (
    SELECT COALESCE(SUM(
      CASE WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
           WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at))/3600.0
           ELSE 0 END
    ), 0) AS total_actual
    FROM demand_time_entries dte
    JOIN demands d ON d.id = dte.demand_id
    WHERE d.workspace = 'tech'
      AND dte.created_at >= v_since
      AND (p_area_id IS NULL OR d.area_id = p_area_id)
      AND (p_project_id IS NULL OR d.project_id = p_project_id)
  ),
  by_area AS (
    SELECT
      da.id   AS area_id,
      da.name AS area_name,
      COALESCE((
        SELECT SUM(dt2.hours_estimated)
        FROM demand_tasks dt2
        JOIN demands d2 ON d2.id = dt2.demand_id
        WHERE d2.workspace = 'tech'
          AND d2.area_id = da.id
          AND d2.created_at >= v_since
          AND (p_project_id IS NULL OR d2.project_id = p_project_id)
      ), 0) AS estimated,
      COALESCE((
        SELECT SUM(
          CASE WHEN dte2.hours_manual IS NOT NULL THEN dte2.hours_manual
               WHEN dte2.started_at IS NOT NULL AND dte2.ended_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (dte2.ended_at - dte2.started_at))/3600.0
               ELSE 0 END
        )
        FROM demand_time_entries dte2
        JOIN demands d3 ON d3.id = dte2.demand_id
        WHERE d3.workspace = 'tech'
          AND d3.area_id = da.id
          AND dte2.created_at >= v_since
          AND (p_project_id IS NULL OR d3.project_id = p_project_id)
      ), 0) AS actual
    FROM demand_areas da
    WHERE p_area_id IS NULL OR da.id = p_area_id
  )
  SELECT json_build_object(
    'total_estimated', (SELECT total_estimated FROM est),
    'total_actual',    (SELECT total_actual    FROM act),
    'by_area', (
      SELECT COALESCE(json_agg(json_build_object(
        'area_id',   area_id,
        'area_name', area_name,
        'estimated', estimated,
        'actual',    actual
      )), '[]'::json)
      FROM by_area
      WHERE estimated > 0 OR actual > 0
    ),
    -- TODO: definir evento de reabertura (enum demand_event_type não tem 'reopened').
    'reopen_count', 0
  ) INTO v_hours;

  RETURN json_build_object(
    'period_days',  p_period_days,
    'generated_at', now(),
    'is_admin',     v_is_admin,
    'alerts',       v_alerts,
    'throughput',   COALESCE(v_throughput, '[]'::json),
    'cycle_time',   v_cycle_time,
    'column_time',  COALESCE(v_column_time, '[]'::json),
    'people',       COALESCE(v_people, '[]'::json),
    'forecast',     v_forecast,
    'hours',        v_hours
  );
END;
$$;

COMMENT ON FUNCTION public.get_tech_dashboard_metrics IS
  'Dashboard TECH: alertas, throughput, cycle time, tempo por coluna, carga por pessoa (admin = todos; usuário = só si mesmo), forecast e horas. Uma chamada retorna tudo.';
