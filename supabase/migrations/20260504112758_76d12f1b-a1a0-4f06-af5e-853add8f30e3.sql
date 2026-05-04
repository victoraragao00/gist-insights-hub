CREATE TABLE public.demand_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  hours_manual NUMERIC(6,2),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_hours CHECK (
    (started_at IS NOT NULL AND ended_at IS NOT NULL AND hours_manual IS NULL)
    OR (started_at IS NULL AND ended_at IS NULL AND hours_manual IS NOT NULL AND hours_manual > 0)
    OR (started_at IS NOT NULL AND ended_at IS NULL AND hours_manual IS NULL)
  )
);

CREATE INDEX idx_time_entries_demand ON public.demand_time_entries(demand_id);
CREATE INDEX idx_time_entries_user ON public.demand_time_entries(user_id);
CREATE INDEX idx_time_entries_active ON public.demand_time_entries(user_id)
  WHERE ended_at IS NULL AND started_at IS NOT NULL;

CREATE UNIQUE INDEX uq_time_entries_one_active_per_user
  ON public.demand_time_entries(user_id)
  WHERE ended_at IS NULL AND started_at IS NOT NULL;

ALTER TABLE public.demand_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON public.demand_time_entries FOR SELECT USING (
  demand_id IN (
    SELECT d.id FROM public.demands d
    WHERE d.client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  )
);

CREATE POLICY "time_entries_insert" ON public.demand_time_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "time_entries_update" ON public.demand_time_entries FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "time_entries_delete" ON public.demand_time_entries FOR DELETE
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_demand_total_hours(p_demand_id UUID)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN hours_manual IS NOT NULL THEN hours_manual
      WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 3600.0
      ELSE 0
    END
  ), 0)::NUMERIC
  FROM public.demand_time_entries
  WHERE demand_id = p_demand_id;
$$;