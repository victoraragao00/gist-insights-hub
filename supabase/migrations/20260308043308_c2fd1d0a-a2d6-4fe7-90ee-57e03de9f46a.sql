
-- ENUM client_tier
CREATE TYPE public.client_tier AS ENUM ('azzas', 'enterprise', 'medium', 'small');

-- Table client_priority_config
CREATE TABLE public.client_priority_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tier public.client_tier NOT NULL,
  weight_multiplier INT NOT NULL DEFAULT 4 CHECK (weight_multiplier BETWEEN 1 AND 4),
  recurrence_window_days INT NOT NULL DEFAULT 15 CHECK (recurrence_window_days BETWEEN 7 AND 90),
  recurrence_threshold_users INT NOT NULL DEFAULT 2 CHECK (recurrence_threshold_users BETWEEN 1 AND 10),
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.client_priority_config ENABLE ROW LEVEL SECURITY;

-- SELECT: users with access to client_id
CREATE POLICY "priority_config_read" ON public.client_priority_config
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.user_accessible_client_ids(auth.uid())));

-- ALL write: only admin role
CREATE POLICY "priority_config_write" ON public.client_priority_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Table priority_scores
CREATE TABLE public.priority_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.priority_scores ENABLE ROW LEVEL SECURITY;

-- SELECT: users with access to client_id
CREATE POLICY "priority_scores_read" ON public.priority_scores
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.user_accessible_client_ids(auth.uid())));
