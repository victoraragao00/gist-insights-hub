
-- Sprint 1: Dynamic classification prompt config
CREATE TABLE public.classification_prompt_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1,
  name text NOT NULL DEFAULT 'Mega Agente',
  system_prompt text NOT NULL,
  valid_themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- Only one active at a time (partial unique index)
CREATE UNIQUE INDEX idx_classification_prompt_active ON public.classification_prompt_config (active) WHERE active = true;

ALTER TABLE public.classification_prompt_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "classification_prompt_select" ON public.classification_prompt_config
  FOR SELECT TO authenticated USING (true);

-- Only admins can insert/update
CREATE POLICY "classification_prompt_insert" ON public.classification_prompt_config
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "classification_prompt_update" ON public.classification_prompt_config
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "classification_prompt_delete" ON public.classification_prompt_config
  FOR DELETE TO authenticated USING (is_admin());
