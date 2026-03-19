-- ============================================================
-- S4: user_profiles + functions (single transaction)
-- ============================================================

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  global_role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (global_role IN ('admin', 'analyst', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. RLS policies
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY user_profiles_select_admin ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT global_role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT global_role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT global_role FROM public.user_profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE INDEX IF NOT EXISTS idx_user_profiles_global_role ON public.user_profiles(global_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- 3. Backfill from auth.users
INSERT INTO public.user_profiles (id, email, full_name, global_role, active)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'viewer',
  true
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- 4. Update user_accessible_client_ids with admin bypass logic
CREATE OR REPLACE FUNCTION public.user_accessible_client_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT c.id FROM public.clients c
  WHERE c.active = true
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up2
      WHERE up2.id = _user_id AND up2.global_role = 'admin'
    )
  UNION
  SELECT uca.client_id FROM public.user_client_access uca
  WHERE uca.user_id = _user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles up3
      WHERE up3.id = _user_id AND up3.global_role = 'admin'
    );
$$;

-- 5. Create get_users_with_permissions (admin-only aggregation)
CREATE OR REPLACE FUNCTION public.get_users_with_permissions()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  global_role TEXT,
  active BOOLEAN,
  client_overrides JSONB,
  last_sign_in TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up_check
    WHERE up_check.id = auth.uid() AND up_check.global_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.email,
    up.full_name,
    up.global_role,
    up.active,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'client_id', uca.client_id,
          'client_name', c.name,
          'role', uca.role
        )
      ) FILTER (WHERE uca.client_id IS NOT NULL),
      '[]'::jsonb
    ) AS client_overrides,
    u.last_sign_in_at
  FROM public.user_profiles up
  LEFT JOIN public.user_client_access uca ON uca.user_id = up.id
  LEFT JOIN public.clients c ON c.id = uca.client_id
  LEFT JOIN auth.users u ON u.id = up.id
  GROUP BY up.id, up.email, up.full_name, up.global_role, up.active, u.last_sign_in_at
  ORDER BY up.global_role ASC, up.email ASC;
END;
$$;