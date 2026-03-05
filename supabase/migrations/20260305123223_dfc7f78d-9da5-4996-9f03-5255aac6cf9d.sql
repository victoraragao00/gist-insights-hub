
CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE clients
  SET active = false
  WHERE active = true
    AND metadata->>'auto_created' = 'true'
    AND (metadata->>'last_seen_at')::timestamptz < NOW() - make_interval(days => _days);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
