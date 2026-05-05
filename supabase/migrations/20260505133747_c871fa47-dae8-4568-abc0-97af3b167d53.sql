DROP TRIGGER IF EXISTS trg_set_project_owner ON public.projects;
DROP FUNCTION IF EXISTS public.set_project_owner();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_members_project_user_unique'
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_project_user_unique UNIQUE (project_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_project(
  p_title       TEXT,
  p_description TEXT    DEFAULT NULL,
  p_due_date    DATE    DEFAULT NULL,
  p_client_id   UUID    DEFAULT NULL,
  p_workspace   TEXT    DEFAULT 'tech'
)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.projects;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_workspace NOT IN ('cx', 'tech', 'both') THEN
    RAISE EXCEPTION 'Invalid workspace: %', p_workspace;
  END IF;

  INSERT INTO public.projects (title, description, due_date, client_id, workspace, owner_id)
  VALUES (p_title, p_description, p_due_date, p_client_id, p_workspace, v_user_id)
  RETURNING * INTO v_result;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (v_result.id, v_user_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN v_result;
END;
$$;

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (true);