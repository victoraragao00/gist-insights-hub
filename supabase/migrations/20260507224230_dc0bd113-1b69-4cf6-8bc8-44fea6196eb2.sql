-- 1) SLA pause columns on demands
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS sla_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_paused_by UUID,
  ADD COLUMN IF NOT EXISTS sla_paused_reason TEXT;

COMMENT ON COLUMN public.demands.sla_paused_at IS 'Quando preenchido, o SLA dessa demanda é considerado encerrado manualmente e ela não aparece em get_demands_with_sla.';

-- 2) demand_priority_config table
CREATE TABLE IF NOT EXISTS public.demand_priority_config (
  priority demand_priority PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  sla_default_hours INTEGER NOT NULL DEFAULT 8,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.demand_priority_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS demand_priority_config_select ON public.demand_priority_config;
CREATE POLICY demand_priority_config_select ON public.demand_priority_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS demand_priority_config_manage ON public.demand_priority_config;
CREATE POLICY demand_priority_config_manage ON public.demand_priority_config
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO public.demand_priority_config (priority, label, color, sla_default_hours, position) VALUES
  ('urgent', 'Urgente', '#E24B4A', 2, 1),
  ('high',   'Alta',    '#F59E0B', 4, 2),
  ('medium', 'Média',   '#3B82F6', 8, 3),
  ('low',    'Baixa',   '#64748B', 24, 4)
ON CONFLICT (priority) DO NOTHING;

-- 3) get_demands_with_sla — respect column position vs sla_stop_position + paused
CREATE OR REPLACE FUNCTION public.get_demands_with_sla(p_user_id uuid)
 RETURNS TABLE(id uuid, title text, priority text, client_id uuid, client_name text, column_id uuid, column_name text, assignee_name text, created_at timestamp with time zone, sla_first_response_at timestamp with time zone, sla_hours_limit integer, sla_elapsed_hours numeric, sla_remaining_hours numeric, sla_percent_used numeric, sla_status text, is_blocked boolean, cancellation_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH stop_pos AS (
    SELECT COALESCE(MIN(position), 2147483647) AS pos
    FROM ticket_columns
    WHERE triggers_sla_response_at = true
  ),
  sla_limits AS (
    SELECT
      d2.id AS demand_id,
      COALESCE(
        (SELECT sc.hours_limit FROM sla_configs sc WHERE sc.client_id = d2.client_id AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.hours_limit FROM sla_configs sc WHERE sc.client_id IS NULL AND sc.priority = d2.priority::TEXT LIMIT 1),
        8
      ) AS hours_limit
    FROM demands d2
    LEFT JOIN ticket_columns tc2 ON tc2.id = d2.column_id
    WHERE d2.client_id IN (SELECT user_accessible_client_ids(p_user_id))
      AND d2.cancellation_reason IS NULL
      AND d2.sla_first_response_at IS NULL
      AND d2.sla_paused_at IS NULL
      AND COALESCE(tc2.triggers_finished_at, false) = false
      AND COALESCE(tc2.position, 0) < (SELECT pos FROM stop_pos)
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
$function$;