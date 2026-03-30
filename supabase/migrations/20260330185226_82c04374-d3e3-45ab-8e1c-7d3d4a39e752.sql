
-- Fix user_profiles UPDATE policy: add fallback to user_client_access admin check
DROP POLICY IF EXISTS user_profiles_update ON public.user_profiles;
CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_client_access.user_id = auth.uid()
        AND user_client_access.role = 'admin'
    )
  )
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_client_access.user_id = auth.uid()
        AND user_client_access.role = 'admin'
    )
  );

-- Add INSERT/UPDATE/DELETE policies for user_client_access (admin only)
DROP POLICY IF EXISTS user_client_access_admin_insert ON public.user_client_access;
CREATE POLICY user_client_access_admin_insert ON public.user_client_access
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_client_access.user_id = auth.uid()
        AND user_client_access.role = 'admin'
    )
  );

DROP POLICY IF EXISTS user_client_access_admin_update ON public.user_client_access;
CREATE POLICY user_client_access_admin_update ON public.user_client_access
  FOR UPDATE TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_client_access.user_id = auth.uid()
        AND user_client_access.role = 'admin'
    )
  );

DROP POLICY IF EXISTS user_client_access_admin_delete ON public.user_client_access;
CREATE POLICY user_client_access_admin_delete ON public.user_client_access
  FOR DELETE TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_client_access.user_id = auth.uid()
        AND user_client_access.role = 'admin'
    )
  );

-- Also allow admins to SELECT all user_client_access rows (not just their own)
DROP POLICY IF EXISTS user_client_access_admin_select ON public.user_client_access;
CREATE POLICY user_client_access_admin_select ON public.user_client_access
  FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access
      WHERE user_client_access.user_id = auth.uid()
        AND user_client_access.role = 'admin'
    )
  );
