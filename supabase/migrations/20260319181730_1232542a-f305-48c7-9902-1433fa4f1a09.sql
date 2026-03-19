-- ============================================================
-- S3: demand_client_tokens + demand_watchers + DB functions
-- ============================================================

-- 1. demand_client_tokens
CREATE TABLE demand_client_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE demand_client_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_client_tokens_select ON demand_client_tokens
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY demand_client_tokens_insert ON demand_client_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY demand_client_tokens_update ON demand_client_tokens
  FOR UPDATE TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY demand_client_tokens_delete ON demand_client_tokens
  FOR DELETE TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  );

-- 2. demand_watchers
CREATE TABLE demand_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(demand_id, user_id)
);

ALTER TABLE demand_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_watchers_select ON demand_watchers
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_watchers_insert ON demand_watchers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY demand_watchers_delete ON demand_watchers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. get_demand_analytics
CREATE OR REPLACE FUNCTION get_demand_analytics(
  p_client_id UUID DEFAULT NULL,
  p_days INT DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH base AS (
    SELECT d.*,
      tc.triggers_finished_at,
      tc.name AS column_name,
      EXTRACT(EPOCH FROM (d.finished_at - d.created_at))/3600 AS lead_time_hours,
      EXTRACT(EPOCH FROM (d.finished_at - d.started_at))/3600 AS cycle_time_hours
    FROM demands d
    JOIN ticket_columns tc ON tc.id = d.column_id
    WHERE (p_client_id IS NULL OR d.client_id = p_client_id)
      AND d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
      AND d.created_at >= now() - (p_days || ' days')::interval
  ),
  by_type AS (
    SELECT dt.name, dt.color, COUNT(*) AS total
    FROM base b
    JOIN demand_types dt ON dt.id = b.demand_type_id
    GROUP BY dt.name, dt.color
  ),
  by_priority AS (
    SELECT priority::text, COUNT(*) AS total
    FROM base GROUP BY priority
  ),
  by_column AS (
    SELECT column_name AS name, COUNT(*) AS total
    FROM base GROUP BY column_name
  ),
  by_area AS (
    SELECT COALESCE(da.name, 'Sem area') AS name, da.color, COUNT(*) AS total
    FROM base b
    LEFT JOIN demand_areas da ON da.id = b.area_id
    GROUP BY da.name, da.color
  ),
  weekly AS (
    SELECT DATE_TRUNC('week', created_at)::date AS week, COUNT(*) AS total
    FROM base GROUP BY 1 ORDER BY 1
  )
  SELECT json_build_object(
    'totals', json_build_object(
      'total', (SELECT COUNT(*) FROM base),
      'open', (SELECT COUNT(*) FROM base WHERE finished_at IS NULL AND NOT COALESCE(is_blocked, false)),
      'completed', (SELECT COUNT(*) FROM base WHERE triggers_finished_at = true AND finished_at IS NOT NULL),
      'blocked', (SELECT COUNT(*) FROM base WHERE COALESCE(is_blocked, false) = true),
      'avg_lead_time_hours', (SELECT ROUND(AVG(lead_time_hours)::NUMERIC, 1) FROM base WHERE lead_time_hours > 0),
      'avg_cycle_time_hours', (SELECT ROUND(AVG(cycle_time_hours)::NUMERIC, 1) FROM base WHERE cycle_time_hours > 0)
    ),
    'by_type', COALESCE((SELECT json_agg(row_to_json(by_type)) FROM by_type), '[]'::json),
    'by_priority', COALESCE((SELECT json_agg(row_to_json(by_priority)) FROM by_priority), '[]'::json),
    'by_column', COALESCE((SELECT json_agg(row_to_json(by_column)) FROM by_column), '[]'::json),
    'by_area', COALESCE((SELECT json_agg(row_to_json(by_area)) FROM by_area), '[]'::json),
    'weekly_trend', COALESCE((SELECT json_agg(row_to_json(weekly)) FROM weekly), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- 4. get_client_public_demands
CREATE OR REPLACE FUNCTION get_client_public_demands(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  result JSON;
BEGIN
  SELECT client_id INTO v_client_id
  FROM demand_client_tokens
  WHERE token = p_token AND active = true;

  IF v_client_id IS NULL THEN
    RETURN json_build_object('error', 'Token invalido');
  END IF;

  SELECT json_build_object(
    'client', (SELECT json_build_object('name', c.name) FROM clients c WHERE c.id = v_client_id),
    'totals', json_build_object(
      'total', COUNT(*),
      'open', COUNT(*) FILTER (WHERE d.finished_at IS NULL),
      'completed', COUNT(*) FILTER (WHERE d.finished_at IS NOT NULL),
      'blocked', COUNT(*) FILTER (WHERE d.is_blocked = true)
    ),
    'demands', COALESCE(json_agg(
      json_build_object(
        'id', d.id,
        'title', d.title,
        'priority', d.priority,
        'type', dt.name,
        'column', tc.name,
        'area', da.name,
        'assignee', ass.name,
        'is_blocked', d.is_blocked,
        'created_at', d.created_at,
        'started_at', d.started_at,
        'finished_at', d.finished_at
      ) ORDER BY d.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM demands d
  JOIN demand_types dt ON dt.id = d.demand_type_id
  JOIN ticket_columns tc ON tc.id = d.column_id
  LEFT JOIN demand_areas da ON da.id = d.area_id
  LEFT JOIN demand_assignees ass ON ass.id = d.assignee_id
  WHERE d.client_id = v_client_id;

  RETURN result;
END;
$$;