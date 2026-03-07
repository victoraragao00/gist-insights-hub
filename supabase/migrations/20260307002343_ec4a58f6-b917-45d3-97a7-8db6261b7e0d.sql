
CREATE OR REPLACE FUNCTION public.create_job_if_none_active(
  _type job_type,
  _created_by uuid,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(job_id uuid, already_running boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_id uuid;
  _new_id uuid;
BEGIN
  -- Lock any active job of this type to prevent race condition
  SELECT id INTO _existing_id
  FROM sync_jobs
  WHERE type = _type AND status IN ('pending', 'running')
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _existing_id IS NOT NULL THEN
    job_id := _existing_id;
    already_running := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- No active job found — create one
  INSERT INTO sync_jobs (type, status, created_by, payload, progress)
  VALUES (_type, 'pending', _created_by, _payload, '{}')
  RETURNING id INTO _new_id;

  job_id := _new_id;
  already_running := false;
  RETURN NEXT;
END;
$$;
