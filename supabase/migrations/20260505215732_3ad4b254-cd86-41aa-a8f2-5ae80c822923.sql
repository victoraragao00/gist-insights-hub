
-- Migration 1: demand_block_history
CREATE TABLE demand_block_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id        UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  blocker_type_id  UUID REFERENCES blocker_types(id) ON DELETE SET NULL,
  blocker_reason   TEXT,
  blocked_by       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  blocked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  unblocked_at     TIMESTAMPTZ,
  unblocked_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_block_history_demand ON demand_block_history(demand_id);
CREATE INDEX idx_block_history_active ON demand_block_history(demand_id) WHERE unblocked_at IS NULL;
CREATE INDEX idx_block_history_type   ON demand_block_history(blocker_type_id) WHERE blocker_type_id IS NOT NULL;

ALTER TABLE demand_block_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_history_select" ON demand_block_history FOR SELECT USING (
  demand_id IN (SELECT d.id FROM demands d WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid())))
);
CREATE POLICY "block_history_insert" ON demand_block_history FOR INSERT WITH CHECK (
  demand_id IN (SELECT d.id FROM demands d WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid())))
);

COMMENT ON TABLE demand_block_history IS
  'Histórico de bloqueios por demanda. Preenchido automaticamente via trigger ao mudar is_blocked.';

-- Migration 2: trigger + RPC
CREATE OR REPLACE FUNCTION track_demand_block_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_blocked = true AND (OLD.is_blocked IS DISTINCT FROM true) THEN
    INSERT INTO demand_block_history (demand_id, blocker_type_id, blocker_reason, blocked_by, blocked_at)
    VALUES (NEW.id, NEW.blocker_type_id, NEW.blocker_reason, auth.uid(), now());
  END IF;
  IF NEW.is_blocked = false AND OLD.is_blocked = true THEN
    UPDATE demand_block_history
    SET unblocked_at = now(), unblocked_by = auth.uid()
    WHERE demand_id = NEW.id AND unblocked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_demand_block_history ON demands;
CREATE TRIGGER trg_demand_block_history
  AFTER UPDATE OF is_blocked ON demands
  FOR EACH ROW EXECUTE FUNCTION track_demand_block_history();

CREATE OR REPLACE FUNCTION get_demand_block_metrics(p_demand_id UUID)
RETURNS JSON
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_blocks', COUNT(*),
    'active_block', COUNT(*) FILTER (WHERE unblocked_at IS NULL),
    'total_time_blocked_hours',
      COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(unblocked_at, now()) - blocked_at)) / 3600.0), 0),
    'avg_block_duration_hours',
      COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(unblocked_at, now()) - blocked_at)) / 3600.0), 0),
    'by_type', (
      SELECT json_agg(json_build_object(
        'blocker_type_id', type_counts.blocker_type_id,
        'name',  bt.name,
        'color', bt.color,
        'count', type_counts.cnt,
        'total_hours', type_counts.hrs
      ))
      FROM (
        SELECT blocker_type_id,
               COUNT(*) AS cnt,
               SUM(EXTRACT(EPOCH FROM (COALESCE(unblocked_at, now()) - blocked_at)) / 3600.0) AS hrs
        FROM demand_block_history
        WHERE demand_id = p_demand_id
        GROUP BY blocker_type_id
      ) type_counts
      LEFT JOIN blocker_types bt ON bt.id = type_counts.blocker_type_id
    )
  )
  FROM demand_block_history
  WHERE demand_id = p_demand_id;
$$;

-- Migration 3: meeting_agendas.project_id + duration default
ALTER TABLE meeting_agendas
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE meeting_agendas
  ALTER COLUMN duration_minutes SET DEFAULT 60;

CREATE INDEX IF NOT EXISTS idx_meeting_agendas_project
  ON meeting_agendas(project_id) WHERE project_id IS NOT NULL;

COMMENT ON COLUMN meeting_agendas.project_id IS
  'Vínculo opcional com projeto. Apenas pautas com agenda_type=internal podem ter project_id.';

-- Migration 4: bypass_client_access + funções atualizadas
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS bypass_client_access BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.bypass_client_access IS
  'Quando true, usuário TECH vê todas as demands independente de user_client_access. Configurado pelo admin em Settings → Equipe.';

CREATE OR REPLACE FUNCTION user_accessible_client_ids(_user_id UUID DEFAULT auth.uid())
RETURNS SETOF UUID
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM clients
  WHERE active = true
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = _user_id
        AND (global_role = 'admin' OR bypass_client_access = true)
    )
  UNION ALL
  SELECT client_id FROM user_client_access
  WHERE user_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = _user_id
        AND (global_role = 'admin' OR bypass_client_access = true)
    );
$$;

CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project        projects%ROWTYPE;
  v_total          INT;
  v_completed      INT;
  v_completion_pct NUMERIC;
  v_overdue_count  INT;
  v_total_hours    NUMERIC;
  v_meeting_hours  NUMERIC;
  v_status         TEXT;
  v_by_column      JSON;
BEGIN
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found: %', p_project_id; END IF;

  IF v_project.owner_id != auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM project_members
       WHERE project_id = p_project_id AND user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total FROM demands WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_completed
  FROM demands d
  JOIN ticket_columns tc ON tc.id = d.column_id
  WHERE d.project_id = p_project_id
    AND tc.triggers_finished_at = true
    AND d.cancellation_reason IS NULL;

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
    WHEN v_total = 0 THEN 'planning'
    WHEN v_completion_pct = 100 THEN 'completed'
    WHEN v_completion_pct > 0 THEN 'active'
    ELSE 'planning' END;

  RETURN json_build_object(
    'project_id',      p_project_id,
    'status',          v_status,
    'total_demands',   v_total,
    'completed',       v_completed,
    'completion_pct',  v_completion_pct,
    'overdue_count',   v_overdue_count,
    'total_hours',     v_total_hours,
    'meeting_hours',   v_meeting_hours,
    'by_column',       COALESCE(v_by_column, '[]'::json)
  );
END;
$$;
