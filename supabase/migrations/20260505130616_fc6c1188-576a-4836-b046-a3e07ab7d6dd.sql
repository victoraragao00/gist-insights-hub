-- ============================================================
-- Migration 1: tabela demand_tasks
-- ============================================================
CREATE TABLE demand_tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id         UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  assignee_id       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'done')),
  hours_estimated   NUMERIC(5,2),
  hours_actual      NUMERIC(5,2),
  position          INT NOT NULL DEFAULT 0,
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demand_tasks_demand   ON demand_tasks(demand_id);
CREATE INDEX idx_demand_tasks_assignee ON demand_tasks(assignee_id)
  WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_demand_tasks_status   ON demand_tasks(demand_id, status);

CREATE OR REPLACE FUNCTION update_demand_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_demand_tasks_updated_at
  BEFORE UPDATE ON demand_tasks
  FOR EACH ROW EXECUTE FUNCTION update_demand_tasks_updated_at();

ALTER TABLE demand_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demand_tasks_select" ON demand_tasks FOR SELECT USING (
  demand_id IN (
    SELECT d.id FROM demands d
    WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  )
);

CREATE POLICY "demand_tasks_insert" ON demand_tasks FOR INSERT
  WITH CHECK (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY "demand_tasks_update" ON demand_tasks FOR UPDATE
  USING (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY "demand_tasks_delete" ON demand_tasks FOR DELETE
  USING (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

COMMENT ON TABLE demand_tasks IS
  'Subdemandas (itens de trabalho) de uma demanda. Quando todas ficam done, a demanda pai é automaticamente concluída via trigger.';

-- ============================================================
-- Migration 2: DB function get_demand_task_stats
-- ============================================================
CREATE OR REPLACE FUNCTION get_demand_task_stats(p_demand_id UUID)
RETURNS JSON
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total',               COUNT(*),
    'done',                COUNT(*) FILTER (WHERE status = 'done'),
    'in_progress',         COUNT(*) FILTER (WHERE status = 'in_progress'),
    'open',                COUNT(*) FILTER (WHERE status = 'open'),
    'completion_pct',      CASE
                             WHEN COUNT(*) = 0 THEN 0
                             ELSE ROUND(COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / COUNT(*) * 100, 1)
                           END,
    'hours_estimated_sum', COALESCE(SUM(hours_estimated), 0),
    'hours_actual_sum',    COALESCE(SUM(hours_actual), 0)
  )
  FROM demand_tasks
  WHERE demand_id = p_demand_id;
$$;

-- ============================================================
-- Migration 3: trigger auto-fechamento da demanda
-- ============================================================
CREATE OR REPLACE FUNCTION check_demand_auto_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_total            INT;
  v_done             INT;
  v_finish_column_id UUID;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN

    SELECT COUNT(*)                                INTO v_total
      FROM demand_tasks WHERE demand_id = NEW.demand_id;

    SELECT COUNT(*) FILTER (WHERE status = 'done') INTO v_done
      FROM demand_tasks WHERE demand_id = NEW.demand_id;

    IF v_total > 0 AND v_total = v_done THEN

      SELECT id INTO v_finish_column_id
        FROM ticket_columns
        WHERE triggers_finished_at = true
        LIMIT 1;

      IF v_finish_column_id IS NOT NULL THEN
        UPDATE demands
          SET column_id    = v_finish_column_id,
              finished_at  = COALESCE(finished_at, now()),
              updated_at   = now()
        WHERE id                  = NEW.demand_id
          AND cancellation_reason IS NULL
          AND finished_at         IS NULL;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_demand_tasks_auto_complete
  AFTER UPDATE OF status ON demand_tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_demand_auto_complete();

COMMENT ON FUNCTION check_demand_auto_complete IS
  'Quando todas as demand_tasks de uma demanda ficam done, move a demanda para a coluna de conclusão automaticamente. Não altera demandas já concluídas ou canceladas.';