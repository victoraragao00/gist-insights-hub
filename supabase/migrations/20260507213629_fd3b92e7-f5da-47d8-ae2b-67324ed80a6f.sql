CREATE OR REPLACE FUNCTION public.deactivate_stale_clients(_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

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

COMMENT ON FUNCTION public.deactivate_stale_clients IS
  'Desativa clients auto_created sem trabalho associado e com last_seen_at > _days dias. SECURITY DEFINER, admin-only via is_admin() guard. Retorna row_count.';