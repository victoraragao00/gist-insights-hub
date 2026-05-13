CREATE OR REPLACE FUNCTION public.check_demand_auto_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total            INT;
  v_done             INT;
  v_finish_column_id UUID;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN

    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE status = 'done')
      INTO v_total, v_done
      FROM demand_tasks
     WHERE demand_id = NEW.demand_id;

    IF v_total > 0 AND v_total = v_done THEN

      SELECT id INTO v_finish_column_id
        FROM ticket_columns
        WHERE triggers_finished_at = true
        ORDER BY position DESC
        LIMIT 1;

      IF v_finish_column_id IS NOT NULL THEN
        BEGIN
          UPDATE demands
            SET column_id   = v_finish_column_id,
                finished_at = COALESCE(finished_at, now()),
                last_updated = now()
          WHERE id                  = NEW.demand_id
            AND cancellation_reason IS NULL
            AND finished_at         IS NULL;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Auto-complete da demanda % falhou: %', NEW.demand_id, SQLERRM;
        END;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;