DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  public.is_project_accessible(id)
);

CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_delete" ON public.projects FOR DELETE
  USING (owner_id = auth.uid());