
-- S3: Add 'read' column to audit_alerts (needed by audit_alerts_summary function)
-- + Create audit_alerts_summary DB function

ALTER TABLE audit_alerts ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION audit_alerts_summary(p_user_id uuid)
RETURNS TABLE(
  total_alerts_30d bigint,
  unread_count bigint,
  alerts jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT user_accessible_client_ids(p_user_id) AS cid
  ),
  recent_alerts AS (
    SELECT
      aa.id,
      c.name AS client_name,
      ar.metric,
      aa.metric_value,
      aa.message,
      aa.read,
      aa.created_at
    FROM audit_alerts aa
    JOIN accessible a ON aa.client_id = a.cid
    JOIN audit_rules ar ON aa.rule_id = ar.id
    JOIN clients c ON aa.client_id = c.id
    WHERE aa.created_at >= now() - interval '30 days'
    ORDER BY aa.created_at DESC
    LIMIT 50
  ),
  totals AS (
    SELECT
      count(*) AS total_alerts_30d,
      count(*) FILTER (WHERE NOT aa.read) AS unread_count
    FROM audit_alerts aa
    JOIN accessible a ON aa.client_id = a.cid
    WHERE aa.created_at >= now() - interval '30 days'
  )
  SELECT
    t.total_alerts_30d,
    t.unread_count,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ra.id,
        'client_name', ra.client_name,
        'metric', ra.metric,
        'metric_value', ra.metric_value,
        'message', ra.message,
        'read', ra.read,
        'created_at', ra.created_at
      )
    ) FILTER (WHERE ra.id IS NOT NULL), '[]'::jsonb) AS alerts
  FROM totals t
  LEFT JOIN recent_alerts ra ON true
  GROUP BY t.total_alerts_30d, t.unread_count;
$$;
