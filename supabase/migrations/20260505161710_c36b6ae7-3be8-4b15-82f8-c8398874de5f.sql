ALTER TABLE demand_tasks
  ADD COLUMN IF NOT EXISTS started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_demand_tasks_started
  ON demand_tasks(started_at) WHERE started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demand_tasks_finished
  ON demand_tasks(finished_at) WHERE finished_at IS NOT NULL;

COMMENT ON COLUMN demand_tasks.started_at  IS 'Preenchido automaticamente quando status -> in_progress pela primeira vez.';
COMMENT ON COLUMN demand_tasks.finished_at IS 'Preenchido automaticamente quando status -> done. Limpo se reaberto.';

CREATE OR REPLACE FUNCTION set_demand_task_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'in_progress'
     AND OLD.status = 'open'
     AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.finished_at := now();
    IF NEW.started_at IS NULL THEN
      NEW.started_at := now();
    END IF;
  END IF;

  IF OLD.status = 'done' AND NEW.status != 'done' THEN
    NEW.finished_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demand_task_dates ON demand_tasks;

CREATE TRIGGER trg_demand_task_dates
  BEFORE UPDATE OF status ON demand_tasks
  FOR EACH ROW EXECUTE FUNCTION set_demand_task_dates();