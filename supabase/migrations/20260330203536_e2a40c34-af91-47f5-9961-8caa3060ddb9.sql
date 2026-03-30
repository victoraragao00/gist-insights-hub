
-- Fix infinite recursion in user_client_access RLS policies
-- The old policies queried user_client_access itself to check admin status, causing recursion.
-- Now using is_admin() which is SECURITY DEFINER and queries user_profiles instead.

DROP POLICY IF EXISTS user_client_access_admin_select ON user_client_access;
DROP POLICY IF EXISTS user_client_access_admin_insert ON user_client_access;
DROP POLICY IF EXISTS user_client_access_admin_update ON user_client_access;
DROP POLICY IF EXISTS user_client_access_admin_delete ON user_client_access;

CREATE POLICY user_client_access_admin_select
  ON user_client_access FOR SELECT
  USING (is_admin() OR user_id = auth.uid());

CREATE POLICY user_client_access_admin_insert
  ON user_client_access FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY user_client_access_admin_update
  ON user_client_access FOR UPDATE
  USING (is_admin());

CREATE POLICY user_client_access_admin_delete
  ON user_client_access FOR DELETE
  USING (is_admin());
