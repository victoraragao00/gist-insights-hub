ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS planned_start_date date,
  ADD COLUMN IF NOT EXISTS planned_end_date date;

CREATE OR REPLACE FUNCTION public.validate_demand_planned_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_end date;
BEGIN
  IF NEW.planned_start_date IS NOT NULL
     AND NEW.planned_end_date IS NOT NULL
     AND NEW.planned_start_date > NEW.planned_end_date THEN
    RAISE EXCEPTION 'A data de início prevista não pode ser posterior à data de fim prevista.';
  END IF;

  IF NEW.planned_end_date IS NOT NULL AND NEW.project_id IS NOT NULL THEN
    SELECT COALESCE(planned_end_date, due_date)
      INTO v_project_end
      FROM public.projects
     WHERE id = NEW.project_id;

    IF v_project_end IS NOT NULL AND NEW.planned_end_date > v_project_end THEN
      RAISE EXCEPTION 'A data de entrega prevista (%) não pode ser posterior à data do projeto (%).',
        to_char(NEW.planned_end_date, 'DD/MM/YYYY'),
        to_char(v_project_end, 'DD/MM/YYYY');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_demand_planned_dates ON public.demands;
CREATE TRIGGER trg_validate_demand_planned_dates
BEFORE INSERT OR UPDATE OF planned_start_date, planned_end_date, project_id
ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.validate_demand_planned_dates();