
-- 1) SLA por tipo de demanda + flag enabled
ALTER TABLE public.sla_configs
  ADD COLUMN IF NOT EXISTS demand_type_id uuid NULL REFERENCES public.demand_types(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- Substitui constraint antiga por unique index considerando demand_type_id (NULL incluso)
ALTER TABLE public.sla_configs DROP CONSTRAINT IF EXISTS sla_configs_client_id_priority_key;
DROP INDEX IF EXISTS public.sla_configs_client_priority_type_uniq;
CREATE UNIQUE INDEX sla_configs_client_priority_type_uniq
  ON public.sla_configs (
    COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(demand_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
    priority
  );

-- 2) Recriar get_demands_with_sla com cascade incluindo demand_type_id e suporte a enabled=false
CREATE OR REPLACE FUNCTION public.get_demands_with_sla(p_user_id uuid)
RETURNS TABLE(
  id uuid, title text, priority text, client_id uuid, client_name text,
  column_id uuid, column_name text, assignee_name text,
  created_at timestamp with time zone, sla_first_response_at timestamp with time zone,
  sla_hours_limit integer, sla_elapsed_hours numeric, sla_remaining_hours numeric,
  sla_percent_used numeric, sla_status text, is_blocked boolean, cancellation_reason text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH stop_pos AS (
    SELECT COALESCE(MIN(position), 2147483647) AS pos
    FROM ticket_columns
    WHERE triggers_sla_response_at = true
  ),
  resolved AS (
    SELECT
      d2.id AS demand_id,
      -- Cascade: client+type+prio -> client+prio(type null) -> global+type+prio -> global+prio(type null)
      COALESCE(
        (SELECT sc.hours_limit FROM sla_configs sc
          WHERE sc.client_id = d2.client_id AND sc.demand_type_id = d2.demand_type_id AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.hours_limit FROM sla_configs sc
          WHERE sc.client_id = d2.client_id AND sc.demand_type_id IS NULL AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.hours_limit FROM sla_configs sc
          WHERE sc.client_id IS NULL AND sc.demand_type_id = d2.demand_type_id AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.hours_limit FROM sla_configs sc
          WHERE sc.client_id IS NULL AND sc.demand_type_id IS NULL AND sc.priority = d2.priority::TEXT LIMIT 1),
        8
      ) AS hours_limit,
      COALESCE(
        (SELECT sc.enabled FROM sla_configs sc
          WHERE sc.client_id = d2.client_id AND sc.demand_type_id = d2.demand_type_id AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.enabled FROM sla_configs sc
          WHERE sc.client_id = d2.client_id AND sc.demand_type_id IS NULL AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.enabled FROM sla_configs sc
          WHERE sc.client_id IS NULL AND sc.demand_type_id = d2.demand_type_id AND sc.priority = d2.priority::TEXT LIMIT 1),
        (SELECT sc.enabled FROM sla_configs sc
          WHERE sc.client_id IS NULL AND sc.demand_type_id IS NULL AND sc.priority = d2.priority::TEXT LIMIT 1),
        true
      ) AS enabled
    FROM demands d2
    LEFT JOIN ticket_columns tc2 ON tc2.id = d2.column_id
    WHERE d2.client_id IN (SELECT user_accessible_client_ids(p_user_id))
      AND d2.cancellation_reason IS NULL
      AND d2.sla_first_response_at IS NULL
      AND d2.sla_paused_at IS NULL
      AND COALESCE(tc2.position, 0) < (SELECT pos FROM stop_pos)
  )
  SELECT
    d.id,
    d.title,
    d.priority::text,
    d.client_id,
    c.name AS client_name,
    d.column_id,
    tc.name AS column_name,
    up.full_name AS assignee_name,
    d.created_at,
    d.sla_first_response_at,
    r.hours_limit AS sla_hours_limit,
    ROUND(EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0, 2)::numeric AS sla_elapsed_hours,
    ROUND(r.hours_limit - EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0, 2)::numeric AS sla_remaining_hours,
    ROUND((EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0) / NULLIF(r.hours_limit, 0) * 100.0, 1)::numeric AS sla_percent_used,
    CASE
      WHEN (EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0) >= r.hours_limit THEN 'vencido'
      WHEN (EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0) >= r.hours_limit * 0.75 THEN 'em_risco'
      ELSE 'ok'
    END AS sla_status,
    COALESCE(d.is_blocked, false) AS is_blocked,
    d.cancellation_reason
  FROM demands d
  JOIN resolved r ON r.demand_id = d.id
  LEFT JOIN clients c ON c.id = d.client_id
  LEFT JOIN ticket_columns tc ON tc.id = d.column_id
  LEFT JOIN user_profiles up ON up.id = d.assignee_id
  WHERE r.enabled = true
    AND d.client_id IN (SELECT user_accessible_client_ids(p_user_id))
    AND d.cancellation_reason IS NULL
    AND d.sla_first_response_at IS NULL
    AND d.sla_paused_at IS NULL
    AND COALESCE(tc.position, 0) < (SELECT pos FROM (SELECT COALESCE(MIN(position), 2147483647) AS pos FROM ticket_columns WHERE triggers_sla_response_at = true) s);
$function$;

-- 3) Seed da configuração de ordenação do Kanban em app_settings
INSERT INTO public.app_settings (key, value)
VALUES ('kanban_sort_mode', '"manual"'::jsonb)
ON CONFLICT (key) DO NOTHING;
