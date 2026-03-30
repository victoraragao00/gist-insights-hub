

## Fix: user_accessible_client_ids PostgREST Resolution

### Problem
All Demands module queries return HTTP 500 via PostgREST. The `user_accessible_client_ids` function works in SQL Editor but fails via REST API due to missing explicit `search_path` and missing `GRANT EXECUTE` permissions.

### Solution
Single migration to recreate the function with `SET search_path = public` (already present but ensuring it's explicit) and add `GRANT EXECUTE` for `authenticated` and `anon` roles.

### Migration SQL
```sql
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
```

### What changes
- 1 migration file (function recreation + grants)

### What does NOT change
- Function logic (identical)
- RLS policies
- Frontend code
- Edge Functions

