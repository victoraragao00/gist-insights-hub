
-- 1. Add heartbeat_at column to sync_jobs
ALTER TABLE public.sync_jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

-- 2. Create claim_next_job function (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS SETOF sync_jobs
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sync_jobs
  SET status = 'running', started_at = COALESCE(started_at, now()), heartbeat_at = now()
  WHERE id = (
    SELECT id FROM sync_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;

-- 3. Enable Realtime for sync_jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
