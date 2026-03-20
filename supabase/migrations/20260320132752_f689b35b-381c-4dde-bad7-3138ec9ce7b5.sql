
-- Fix infinite recursion: user_profiles_select_admin does a sub-select on user_profiles itself
-- This is redundant since user_profiles_select_active already allows reading active profiles
DROP POLICY IF EXISTS user_profiles_select_admin ON user_profiles;
