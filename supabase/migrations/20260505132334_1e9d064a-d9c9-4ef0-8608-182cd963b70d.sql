CREATE OR REPLACE FUNCTION public.is_project_accessible(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_project_accessible IS
  'Verifica se o usuário logado é owner ou membro do projeto. SECURITY DEFINER para evitar recursão infinita nas policies de RLS.';

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  public.is_project_accessible(id)
);

DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
CREATE POLICY "project_members_select" ON public.project_members FOR SELECT USING (
  public.is_project_accessible(project_id)
);

DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND owner_id = auth.uid()
    )
  );