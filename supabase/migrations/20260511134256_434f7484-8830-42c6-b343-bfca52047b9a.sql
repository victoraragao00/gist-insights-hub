DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY demand_notifications_insert ON public.demand_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);