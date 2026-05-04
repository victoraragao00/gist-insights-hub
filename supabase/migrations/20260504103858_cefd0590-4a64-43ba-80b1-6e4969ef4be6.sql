-- 1. Atualizar o trigger para considerar posição relativa
CREATE OR REPLACE FUNCTION mark_sla_first_response()
RETURNS TRIGGER AS $$
DECLARE
  v_sla_col_position INT;
  v_new_col_position INT;
BEGIN
  IF NEW.column_id IS DISTINCT FROM OLD.column_id
     AND NEW.sla_first_response_at IS NULL THEN
    SELECT position INTO v_sla_col_position
    FROM ticket_columns
    WHERE triggers_sla_response_at = true
    LIMIT 1;
    SELECT position INTO v_new_col_position
    FROM ticket_columns
    WHERE id = NEW.column_id;
    IF v_sla_col_position IS NOT NULL
       AND v_new_col_position IS NOT NULL
       AND v_new_col_position >= v_sla_col_position THEN
      NEW.sla_first_response_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Backfill: corrigir demandas já afetadas
-- Nota: tabela demands usa "last_updated" em vez de "updated_at"
UPDATE demands d
SET sla_first_response_at = COALESCE(d.finished_at, d.last_updated, now())
WHERE d.sla_first_response_at IS NULL
  AND EXISTS (
    SELECT 1 FROM ticket_columns tc
    WHERE tc.id = d.column_id
      AND tc.position >= (
        SELECT position FROM ticket_columns
        WHERE triggers_sla_response_at = true LIMIT 1
      )
  );