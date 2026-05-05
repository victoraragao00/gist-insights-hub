-- Migration 1: task_id em demand_time_entries
ALTER TABLE demand_time_entries
  ADD COLUMN IF NOT EXISTS task_id UUID
    REFERENCES demand_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_time_entries_task
  ON demand_time_entries(task_id)
  WHERE task_id IS NOT NULL;

COMMENT ON COLUMN demand_time_entries.task_id IS
  'NULL = entrada de tempo da demanda diretamente. NOT NULL = entrada de tempo de uma subdemanda (demand_task). Timer ativo unico por usuario independente de task_id.';

-- Migration 2: indice unico de timer ativo
DROP INDEX IF EXISTS uq_time_entries_one_active_per_user;

CREATE UNIQUE INDEX uq_time_entries_one_active_per_user
  ON demand_time_entries(user_id)
  WHERE ended_at IS NULL AND started_at IS NOT NULL;

COMMENT ON INDEX uq_time_entries_one_active_per_user IS
  'Garante no maximo 1 timer ativo por usuario - seja em demanda ou task.';

-- Migration 3: get_demand_total_hours
CREATE OR REPLACE FUNCTION get_demand_total_hours(p_demand_id UUID)
RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN dte.hours_manual IS NOT NULL
        THEN dte.hours_manual
      WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
      ELSE 0
    END
  ), 0)::NUMERIC
  FROM demand_time_entries dte
  WHERE
    (dte.demand_id = p_demand_id AND dte.task_id IS NULL)
    OR
    dte.task_id IN (
      SELECT id FROM demand_tasks WHERE demand_id = p_demand_id
    );
$$;

-- Migration 4: get_demand_task_stats
CREATE OR REPLACE FUNCTION get_demand_task_stats(p_demand_id UUID)
RETURNS JSON
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH task_hours AS (
    SELECT
      dt.id AS task_id,
      dt.status,
      dt.hours_estimated,
      COALESCE(SUM(
        CASE
          WHEN dte.hours_manual IS NOT NULL
            THEN dte.hours_manual
          WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
          ELSE 0
        END
      ), 0) AS hours_actual_computed
    FROM demand_tasks dt
    LEFT JOIN demand_time_entries dte ON dte.task_id = dt.id
    WHERE dt.demand_id = p_demand_id
    GROUP BY dt.id, dt.status, dt.hours_estimated
  )
  SELECT json_build_object(
    'total',               COUNT(*),
    'done',                COUNT(*) FILTER (WHERE status = 'done'),
    'in_progress',         COUNT(*) FILTER (WHERE status = 'in_progress'),
    'open',                COUNT(*) FILTER (WHERE status = 'open'),
    'completion_pct',      CASE
                             WHEN COUNT(*) = 0 THEN 0
                             ELSE ROUND(
                               COUNT(*) FILTER (WHERE status = 'done')::NUMERIC
                               / COUNT(*) * 100, 1
                             )
                           END,
    'hours_estimated_sum', COALESCE(SUM(hours_estimated), 0),
    'hours_actual_sum',    COALESCE(SUM(hours_actual_computed), 0)
  )
  FROM task_hours;
$$;