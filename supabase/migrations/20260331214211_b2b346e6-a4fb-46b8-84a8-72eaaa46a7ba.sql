CREATE TABLE public.demand_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(demand_id, conversation_id)
);

ALTER TABLE public.demand_conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY summaries_select ON public.demand_conversation_summaries
  FOR SELECT TO authenticated USING (
    demand_id IN (SELECT d.id FROM demands d WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid())))
  );
CREATE POLICY summaries_insert ON public.demand_conversation_summaries
  FOR INSERT TO authenticated WITH CHECK (
    demand_id IN (SELECT d.id FROM demands d WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid())))
    AND created_by = auth.uid()
  );
CREATE POLICY summaries_delete ON public.demand_conversation_summaries
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX idx_conv_summaries_demand ON public.demand_conversation_summaries(demand_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.demand_conversation_summaries;