CREATE OR REPLACE FUNCTION public.get_demand_analytics(p_client_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'open', (SELECT COUNT(*) FROM base WHERE finished_at IS NULL AND NOT COALESCE(is_blocked, false) AND cancellation_reason IS NULL),
      'completed', (SELECT COUNT(*) FROM base WHERE finished_at IS NOT NULL AND cancellation_reason IS NULL),
      'blocked', (SELECT COUNT(*) FROM base WHERE COALESCE(is_blocked, false) = true),
      'cancelled', (SELECT COUNT(*) FROM base WHERE cancellation_reason IS NOT NULL),
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
$function$;