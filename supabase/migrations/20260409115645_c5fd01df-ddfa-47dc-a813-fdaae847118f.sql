
-- 1. sla_configs table
CREATE TABLE public.sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  priority TEXT NOT NULL,
  hours_limit INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, priority)
);

ALTER TABLE public.sla_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sla_configs_select ON public.sla_configs
  FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
    OR client_id IS NULL
  );

CREATE POLICY sla_configs_manage ON public.sla_configs
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE INDEX idx_sla_configs_client ON public.sla_configs(client_id);

-- Seed global defaults
INSERT INTO public.sla_configs (client_id, priority, hours_limit) VALUES
  (NULL, 'urgent', 2),
  (NULL, 'high', 4),
  (NULL, 'medium', 8),
  (NULL, 'low', 24)
ON CONFLICT DO NOTHING;

-- 2. Add sla_first_response_at to demands
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS sla_first_response_at TIMESTAMPTZ;

-- 3. RPC function
CREATE OR REPLACE FUNCTION public.get_demands_with_sla(p_user_id uuid)
RETURNS TABLE (
  id UUID,
  title TEXT,
  priority TEXT,
  client_id UUID,
  client_name TEXT,
  column_id UUID,
  column_name TEXT,
  assignee_name TEXT,
  created_at TIMESTAMPTZ,
  sla_first_response_at TIMESTAMPTZ,
  sla_hours_limit INTEGER,
  sla_elapsed_hours NUMERIC,
  sla_remaining_hours NUMERIC,
  sla_percent_used NUMERIC,
  sla_status TEXT,
  is_blocked BOOLEAN,
  cancellation_reason TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sla_limits AS (
    SELECT
      d2.id AS demand_id,
      COALESCE(
        (SELECT sc.hours_limit FROM sla_configs sc WHERE sc.client_id = d2.client_id AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.hours_limit FROM sla_configs sc WHERE sc.client_id IS NULL AND sc.priority = d2.priority::TEXT LIMIT 1),
        8
      ) AS hours_limit
    FROM demands d2
    WHERE d2.client_id IN (SELECT user_accessible_client_ids(p_user_id))
      AND d2.cancellation_reason IS NULL
      AND d2.sla_first_response_at IS NULL
  )
  SELECT
    d.id,
    d.title,
    d.priority::TEXT,
    d.client_id,
    c.name AS client_name,
    d.column_id,
    tc.name AS column_name,
    COALESCE(up.full_name, up.email) AS assignee_name,
    d.created_at,
    d.sla_first_response_at,
    sl.hours_limit AS sla_hours_limit,
    ROUND((EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600)::NUMERIC, 2) AS sla_elapsed_hours,
    ROUND((sl.hours_limit - EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600)::NUMERIC, 2) AS sla_remaining_hours,
    LEAST(
      ROUND((EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600 / NULLIF(sl.hours_limit, 0) * 100)::NUMERIC, 1),
      100
    ) AS sla_percent_used,
    CASE
      WHEN EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600 >= sl.hours_limit THEN 'vencido'
      WHEN EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600 >= sl.hours_limit * 0.75 THEN 'em_risco'
      ELSE 'ok'
    END AS sla_status,
    d.is_blocked,
    d.cancellation_reason
  FROM demands d
  JOIN sla_limits sl ON sl.demand_id = d.id
  JOIN clients c ON c.id = d.client_id
  LEFT JOIN ticket_columns tc ON tc.id = d.column_id
  LEFT JOIN user_profiles up ON up.id = d.assignee_id
  ORDER BY
    CASE
      WHEN EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600 >= sl.hours_limit THEN 0
      WHEN d.priority = 'urgent' THEN 1
      WHEN d.priority = 'high' THEN 2
      WHEN d.priority = 'medium' THEN 3
      ELSE 4
    END,
    d.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_demands_with_sla(uuid) TO authenticated;

-- 4. Trigger to mark SLA first response
CREATE OR REPLACE FUNCTION public.mark_sla_first_response()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.column_id IS DISTINCT FROM OLD.column_id AND NEW.sla_first_response_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM ticket_columns
      WHERE id = NEW.column_id AND triggers_started_at = true
    ) THEN
      NEW.sla_first_response_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_sla_first_response
  BEFORE UPDATE ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.mark_sla_first_response();
