
-- Function: when a new client is created, grant viewer access to all existing auth users
CREATE OR REPLACE FUNCTION public.grant_new_client_to_all_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_client_access (user_id, client_id, role)
  SELECT au.id, NEW.id, 'viewer'
  FROM auth.users au
  WHERE NOT EXISTS (
    SELECT 1 FROM user_client_access uca
    WHERE uca.user_id = au.id AND uca.client_id = NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_new_client_to_all_users();

-- Backfill: grant viewer access to existing users that have 0 records
INSERT INTO user_client_access (user_id, client_id, role)
SELECT au.id, c.id, 'viewer'
FROM auth.users au
CROSS JOIN clients c
WHERE c.active = true
  AND NOT EXISTS (
    SELECT 1 FROM user_client_access uca
    WHERE uca.user_id = au.id AND uca.client_id = c.id
  );
