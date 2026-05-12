-- Allow admins to delete projects (cancel/excluir)
DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

-- Comment attachments table
CREATE TABLE public.demand_comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.demand_comments(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('file','link')),
  url text NOT NULL,
  filename text,
  size_bytes bigint,
  mime_type text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demand_comment_attachments_comment ON public.demand_comment_attachments(comment_id);
CREATE INDEX idx_demand_comment_attachments_demand ON public.demand_comment_attachments(demand_id);

ALTER TABLE public.demand_comment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_comment_attachments_select ON public.demand_comment_attachments
  FOR SELECT TO authenticated
  USING (demand_id IN (
    SELECT demands.id FROM demands
    WHERE demands.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  ));

CREATE POLICY demand_comment_attachments_insert ON public.demand_comment_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND demand_id IN (
      SELECT demands.id FROM demands
      WHERE demands.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_comment_attachments_delete ON public.demand_comment_attachments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());
