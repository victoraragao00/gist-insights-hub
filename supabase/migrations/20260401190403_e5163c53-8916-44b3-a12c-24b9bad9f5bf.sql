CREATE OR REPLACE FUNCTION public.grant_new_client_to_all_users()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO user_client_access (user_id, client_id, role)
  SELECT up.id, NEW.id, up.global_role
  FROM user_profiles up
  WHERE up.global_role = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM user_client_access uca
      WHERE uca.user_id = up.id AND uca.client_id = NEW.id
    );
  RETURN NEW;
END;
$$;