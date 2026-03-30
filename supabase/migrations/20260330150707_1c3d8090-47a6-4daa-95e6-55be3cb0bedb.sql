-- Rewrite UPDATE policy on user_profiles to allow admin to update ALL fields (global_role AND active)
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());