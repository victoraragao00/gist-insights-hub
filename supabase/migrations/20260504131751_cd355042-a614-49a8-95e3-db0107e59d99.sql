
CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE clients c
  SET active = false
  WHERE c.active = true
    AND c.metadata->>'auto_created' = 'true'
    AND (c.metadata->>'last_seen_at')::timestamptz < NOW() - make_interval(days => _days)
    AND NOT EXISTS (SELECT 1 FROM interactions i      WHERE i.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM demands d           WHERE d.client_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM meeting_agendas m   WHERE m.client_id = c.id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
