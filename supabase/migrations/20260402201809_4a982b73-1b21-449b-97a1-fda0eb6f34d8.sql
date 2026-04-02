-- Add resolution column to demands
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS resolution TEXT;

-- Create AI analyses table
CREATE TABLE public.demand_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  problem_summary TEXT NOT NULL,
  suggested_resolution TEXT NOT NULL,
  context_used JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(demand_id)
);

ALTER TABLE public.demand_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY analyses_select ON public.demand_ai_analyses
  FOR SELECT TO authenticated USING (
    demand_id IN (
      SELECT d.id FROM public.demands d
      WHERE d.client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY analyses_insert ON public.demand_ai_analyses
  FOR INSERT TO authenticated WITH CHECK (
    demand_id IN (
      SELECT d.id FROM public.demands d
      WHERE d.client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
    )
    AND created_by = auth.uid()
  );

CREATE POLICY analyses_delete ON public.demand_ai_analyses
  FOR DELETE TO authenticated USING (
    demand_id IN (
      SELECT d.id FROM public.demands d
      WHERE d.client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
    )
  );

CREATE INDEX idx_demand_ai_analyses_demand ON public.demand_ai_analyses(demand_id);