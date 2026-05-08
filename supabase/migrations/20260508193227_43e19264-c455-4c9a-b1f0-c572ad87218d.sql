-- 1) RFI XOR demand/project
ALTER TABLE public.rfis ALTER COLUMN demand_id DROP NOT NULL;
ALTER TABLE public.rfis DROP CONSTRAINT IF EXISTS rfis_demand_id_key;
ALTER TABLE public.rfis ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS rfis_demand_id_unique ON public.rfis(demand_id) WHERE demand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rfis_project_id ON public.rfis(project_id) WHERE project_id IS NOT NULL;
ALTER TABLE public.rfis DROP CONSTRAINT IF EXISTS rfis_xor_link;
ALTER TABLE public.rfis ADD CONSTRAINT rfis_xor_link CHECK ((demand_id IS NOT NULL) <> (project_id IS NOT NULL));

-- Update RLS to allow access via project_id too
DROP POLICY IF EXISTS "rfis_select" ON public.rfis;
DROP POLICY IF EXISTS "rfis_insert" ON public.rfis;
DROP POLICY IF EXISTS "rfis_update" ON public.rfis;
DROP POLICY IF EXISTS "rfis_delete" ON public.rfis;

CREATE POLICY "rfis_select" ON public.rfis FOR SELECT TO authenticated USING (
  (demand_id IS NOT NULL AND demand_id IN (SELECT id FROM public.demands WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
  OR (project_id IS NOT NULL AND project_id IN (SELECT id FROM public.projects WHERE is_internal = true OR client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
);
CREATE POLICY "rfis_insert" ON public.rfis FOR INSERT TO authenticated WITH CHECK (
  (demand_id IS NOT NULL AND demand_id IN (SELECT id FROM public.demands WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
  OR (project_id IS NOT NULL AND project_id IN (SELECT id FROM public.projects WHERE is_internal = true OR client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
);
CREATE POLICY "rfis_update" ON public.rfis FOR UPDATE TO authenticated USING (
  (demand_id IS NOT NULL AND demand_id IN (SELECT id FROM public.demands WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
  OR (project_id IS NOT NULL AND project_id IN (SELECT id FROM public.projects WHERE is_internal = true OR client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
);
CREATE POLICY "rfis_delete" ON public.rfis FOR DELETE TO authenticated USING (
  (demand_id IS NOT NULL AND demand_id IN (SELECT id FROM public.demands WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
  OR (project_id IS NOT NULL AND project_id IN (SELECT id FROM public.projects WHERE is_internal = true OR client_id IN (SELECT user_accessible_client_ids(auth.uid()))))
);

-- 2) Projects planned/actual dates
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date,
  ADD COLUMN IF NOT EXISTS actual_start_date date,
  ADD COLUMN IF NOT EXISTS actual_end_date date;

UPDATE public.projects SET planned_end_date = due_date WHERE planned_end_date IS NULL AND due_date IS NOT NULL;
UPDATE public.projects SET planned_start_date = created_at::date WHERE planned_start_date IS NULL;

-- Keep due_date in sync with planned_end_date
CREATE OR REPLACE FUNCTION public.sync_project_due_date()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.planned_end_date IS DISTINCT FROM OLD.planned_end_date THEN
    NEW.due_date := NEW.planned_end_date;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_projects_sync_due_date ON public.projects;
CREATE TRIGGER trg_projects_sync_due_date BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_due_date();

-- 3) Project date change history
CREATE TABLE IF NOT EXISTS public.project_date_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('planned_start','planned_end','actual_start','actual_end')),
  old_value date,
  new_value date,
  changed_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX IF NOT EXISTS idx_project_date_changes_project ON public.project_date_changes(project_id, changed_at DESC);

ALTER TABLE public.project_date_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_date_changes_select" ON public.project_date_changes;
CREATE POLICY "project_date_changes_select" ON public.project_date_changes FOR SELECT TO authenticated USING (
  project_id IN (SELECT id FROM public.projects WHERE is_internal = true OR client_id IN (SELECT user_accessible_client_ids(auth.uid())))
);

CREATE OR REPLACE FUNCTION public.log_project_date_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NEW.planned_start_date IS DISTINCT FROM OLD.planned_start_date THEN
    INSERT INTO public.project_date_changes(project_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'planned_start', OLD.planned_start_date, NEW.planned_start_date, uid);
  END IF;
  IF NEW.planned_end_date IS DISTINCT FROM OLD.planned_end_date THEN
    INSERT INTO public.project_date_changes(project_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'planned_end', OLD.planned_end_date, NEW.planned_end_date, uid);
  END IF;
  IF NEW.actual_start_date IS DISTINCT FROM OLD.actual_start_date THEN
    INSERT INTO public.project_date_changes(project_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'actual_start', OLD.actual_start_date, NEW.actual_start_date, uid);
  END IF;
  IF NEW.actual_end_date IS DISTINCT FROM OLD.actual_end_date THEN
    INSERT INTO public.project_date_changes(project_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'actual_end', OLD.actual_end_date, NEW.actual_end_date, uid);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_projects_log_date_changes ON public.projects;
CREATE TRIGGER trg_projects_log_date_changes AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.log_project_date_changes();