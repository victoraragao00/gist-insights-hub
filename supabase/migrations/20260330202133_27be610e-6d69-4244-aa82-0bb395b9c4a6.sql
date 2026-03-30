CREATE OR REPLACE FUNCTION public.user_accessible_client_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.clients c
  WHERE c.active = true
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up2
      WHERE up2.id = _user_id
        AND up2.global_role = 'admin'
    )
  UNION
  SELECT uca.client_id
  FROM public.user_client_access uca
  WHERE uca.user_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up3
      WHERE up3.id = _user_id
        AND up3.global_role = 'admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_accessible_client_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_accessible_client_ids(uuid) TO anon;