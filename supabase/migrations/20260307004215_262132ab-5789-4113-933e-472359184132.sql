
-- 1. Create app_settings table
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read settings
CREATE POLICY "app_settings_read" ON public.app_settings
FOR SELECT TO authenticated USING (true);

-- Any authenticated user can update settings
CREATE POLICY "app_settings_update" ON public.app_settings
FOR UPDATE TO authenticated USING (true);

-- Insert initial auto_sync_enabled flag
INSERT INTO public.app_settings (key, value) VALUES ('auto_sync_enabled', 'true');

-- 2. RLS policy for automated sync_jobs (created_by IS NULL) - SELECT
CREATE POLICY "sync_jobs_automated_select" ON public.sync_jobs
FOR SELECT TO authenticated USING (created_by IS NULL);

-- 3. RLS policy for automated sync_jobs - UPDATE (so users can cancel stuck automated jobs)
CREATE POLICY "sync_jobs_automated_update" ON public.sync_jobs
FOR UPDATE TO authenticated USING (created_by IS NULL);
