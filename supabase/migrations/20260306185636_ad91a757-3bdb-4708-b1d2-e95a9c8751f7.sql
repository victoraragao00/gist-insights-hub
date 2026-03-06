
-- ENUMs
CREATE TYPE public.job_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE public.job_type AS ENUM ('sync_contacts', 'ingest_historical', 'classify_batch', 'transcribe_audio');

-- Tabela
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type job_type NOT NULL,
  status job_status DEFAULT 'pending',
  client_id UUID REFERENCES public.clients(id),
  payload JSONB DEFAULT '{}',
  progress JSONB DEFAULT '{}',
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status, created_at DESC);
CREATE INDEX idx_sync_jobs_client ON public.sync_jobs(client_id, created_at DESC);

-- RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_jobs_access ON public.sync_jobs FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR client_id IN (SELECT user_accessible_client_ids(auth.uid()))
);

CREATE POLICY sync_jobs_insert ON public.sync_jobs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY sync_jobs_update ON public.sync_jobs FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());
