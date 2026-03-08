
-- S2 Part 1: Unique constraint for audit_rules dedup + realtime for audit_alerts

-- Unique constraint to prevent duplicate rules per client+metric
ALTER TABLE audit_rules ADD CONSTRAINT audit_rules_client_metric_unique
  UNIQUE (client_id, metric);

-- Enable realtime for audit_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_alerts;
