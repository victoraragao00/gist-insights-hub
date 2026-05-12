CREATE OR REPLACE FUNCTION public.get_project_stats(p_project_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- A demand is considered "started" if it already has started_at OR
  -- it currently sits in a column flagged as triggers_started_at.
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

  SELECT COALESCE(SUM(
    CASE
      WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
      WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
      ELSE 0 END
  ), 0) INTO v_total_hours
  FROM demand_time_entries dte
  JOIN demands d ON d.id = dte.demand_id
  WHERE d.project_id = p_project_id;

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
$function$;