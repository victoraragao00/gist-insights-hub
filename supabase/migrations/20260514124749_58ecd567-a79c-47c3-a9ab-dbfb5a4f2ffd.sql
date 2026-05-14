-- 1. get_demand_total_hours: include demand_tasks.hours_actual (manual numeric on subdemandas)
CREATE OR REPLACE FUNCTION public.get_demand_total_hours(p_demand_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT SUM(
        CASE
          WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
          WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
          ELSE 0
        END
      )
      FROM demand_time_entries dte
      WHERE
        (dte.demand_id = p_demand_id AND dte.task_id IS NULL)
        OR dte.task_id IN (SELECT id FROM demand_tasks WHERE demand_id = p_demand_id)
    ), 0)
    +
    COALESCE((
      SELECT SUM(hours_actual)
      FROM demand_tasks
      WHERE demand_id = p_demand_id AND hours_actual IS NOT NULL
    ), 0);
$$;

-- 2. get_project_stats: include demand_tasks.hours_actual in v_total_hours
CREATE OR REPLACE FUNCTION public.get_project_stats(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project        projects%ROWTYPE;
  v_total          INT;
  v_completed      INT;
  v_started        INT;
  v_completion_pct NUMERIC;
  v_overdue_count  INT;
  v_total_hours    NUMERIC;
  v_meeting_hours  NUMERIC;
  v_status         TEXT;
  v_by_column      JSON;
  v_hours_pct      NUMERIC;
BEGIN
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found: %', p_project_id; END IF;

  IF v_project.owner_id != auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM project_members
       WHERE project_id = p_project_id AND user_id = auth.uid()
     )
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total FROM demands WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_completed
  FROM demands d
  JOIN ticket_columns tc ON tc.id = d.column_id
  WHERE d.project_id = p_project_id
    AND tc.triggers_finished_at = true
    AND d.cancellation_reason IS NULL;

  SELECT COUNT(*) INTO v_started
  FROM demands d
  JOIN ticket_columns tc ON tc.id = d.column_id
  WHERE d.project_id = p_project_id
    AND d.cancellation_reason IS NULL
    AND (d.started_at IS NOT NULL OR COALESCE(tc.triggers_started_at, false) = true);

  v_completion_pct := CASE WHEN v_total = 0 THEN 0
    ELSE ROUND((v_completed::NUMERIC / v_total) * 100, 1) END;

  IF v_project.due_date IS NOT NULL THEN
    SELECT COUNT(*) INTO v_overdue_count
    FROM demands d
    WHERE d.project_id = p_project_id
      AND d.cancellation_reason IS NULL
      AND d.finished_at IS NULL
      AND d.created_at::DATE > v_project.due_date;
  ELSE v_overdue_count := 0; END IF;

  -- Total hours = time entries (demand-level + task-level) + manual hours_actual on tasks
  SELECT
    COALESCE((
      SELECT SUM(
        CASE
          WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
          WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
          ELSE 0 END)
      FROM demand_time_entries dte
      JOIN demands d ON d.id = dte.demand_id
      WHERE d.project_id = p_project_id
    ), 0)
    +
    COALESCE((
      SELECT SUM(dt.hours_actual)
      FROM demand_tasks dt
      JOIN demands d ON d.id = dt.demand_id
      WHERE d.project_id = p_project_id AND dt.hours_actual IS NOT NULL
    ), 0)
  INTO v_total_hours;

  SELECT COALESCE(SUM(duration_minutes) / 60.0, 0) INTO v_meeting_hours
  FROM meeting_agendas
  WHERE project_id = p_project_id
    AND agenda_type = 'internal';

  SELECT json_agg(json_build_object(
    'column_id', tc.id, 'column_name', tc.name, 'count', col_counts.cnt
  )) INTO v_by_column
  FROM (
    SELECT d.column_id, COUNT(*) as cnt FROM demands d
    WHERE d.project_id = p_project_id GROUP BY d.column_id
  ) col_counts
  JOIN ticket_columns tc ON tc.id = col_counts.column_id;

  v_status := CASE
    WHEN v_project.cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN v_total > 0 AND v_completion_pct = 100 THEN 'completed'
    WHEN v_started > 0 OR v_completed > 0 THEN 'active'
    ELSE 'planning' END;

  v_hours_pct := CASE
    WHEN v_project.hours_estimated IS NULL OR v_project.hours_estimated = 0 THEN NULL
    ELSE ROUND((v_total_hours / v_project.hours_estimated) * 100, 1)
  END;

  RETURN json_build_object(
    'project_id',         p_project_id,
    'status',             v_status,
    'total_demands',      v_total,
    'completed',          v_completed,
    'completion_pct',     v_completion_pct,
    'overdue_count',      v_overdue_count,
    'total_hours',        v_total_hours,
    'meeting_hours',      v_meeting_hours,
    'hours_estimated',    v_project.hours_estimated,
    'hours_progress_pct', v_hours_pct,
    'by_column',          COALESCE(v_by_column, '[]'::json)
  );
END;
$$;

-- 3. get_client_hours_breakdown: aggregate hours by avulsa vs per project for a client
CREATE OR REPLACE FUNCTION public.get_client_hours_breakdown(p_client_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_client_id NOT IN (SELECT public.user_accessible_client_ids(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH demand_hours AS (
    SELECT
      d.id,
      d.title,
      d.project_id,
      d.started_at,
      d.finished_at,
      COALESCE((
        SELECT SUM(
          CASE
            WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
            WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
            ELSE 0 END)
        FROM demand_time_entries dte
        WHERE (dte.demand_id = d.id AND dte.task_id IS NULL)
           OR dte.task_id IN (SELECT id FROM demand_tasks WHERE demand_id = d.id)
      ), 0)
      +
      COALESCE((
        SELECT SUM(hours_actual) FROM demand_tasks
        WHERE demand_id = d.id AND hours_actual IS NOT NULL
      ), 0) AS hours
    FROM demands d
    WHERE d.client_id = p_client_id
      AND d.cancellation_reason IS NULL
  ),
  avulsas AS (
    SELECT id, title, hours, started_at, finished_at
    FROM demand_hours
    WHERE project_id IS NULL AND hours > 0
    ORDER BY hours DESC
  ),
  avulsas_agg AS (
    SELECT
      COALESCE(SUM(hours), 0) AS total,
      COUNT(*) AS cnt,
      COALESCE(json_agg(json_build_object(
        'id', id, 'title', title, 'hours', hours,
        'started_at', started_at, 'finished_at', finished_at
      )), '[]'::json) AS demands
    FROM avulsas
  ),
  projetos AS (
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      COALESCE(SUM(dh.hours), 0) AS hours,
      COUNT(dh.id) AS demand_count,
      COALESCE(json_agg(json_build_object(
        'id', dh.id, 'title', dh.title, 'hours', dh.hours
      ) ORDER BY dh.hours DESC) FILTER (WHERE dh.id IS NOT NULL), '[]'::json) AS demands
    FROM projects p
    LEFT JOIN demand_hours dh ON dh.project_id = p.id
    WHERE p.client_id = p_client_id
    GROUP BY p.id, p.name
    HAVING COALESCE(SUM(dh.hours), 0) > 0
    ORDER BY COALESCE(SUM(dh.hours), 0) DESC
  ),
  projetos_agg AS (
    SELECT COALESCE(json_agg(json_build_object(
      'project_id', project_id,
      'project_name', project_name,
      'hours', hours,
      'demand_count', demand_count,
      'demands', demands
    )), '[]'::json) AS items,
    COALESCE(SUM(hours), 0) AS total
    FROM projetos
  )
  SELECT json_build_object(
    'client_id', p_client_id,
    'total_hours', (SELECT total FROM avulsas_agg) + (SELECT total FROM projetos_agg),
    'avulsas', json_build_object(
      'hours', (SELECT total FROM avulsas_agg),
      'demand_count', (SELECT cnt FROM avulsas_agg),
      'demands', (SELECT demands FROM avulsas_agg)
    ),
    'projetos', (SELECT items FROM projetos_agg)
  ) INTO v_result;

  RETURN v_result;
END;
$$;