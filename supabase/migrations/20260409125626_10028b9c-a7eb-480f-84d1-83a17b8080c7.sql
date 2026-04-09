-- Add new column for SLA response trigger
ALTER TABLE public.ticket_columns
  ADD COLUMN IF NOT EXISTS triggers_sla_response_at BOOLEAN DEFAULT false;

-- Migrate existing data: copy triggers_started_at to triggers_sla_response_at
UPDATE public.ticket_columns
SET triggers_sla_response_at = triggers_started_at
WHERE triggers_started_at = true;

-- Update the trigger function to use new field
CREATE OR REPLACE FUNCTION public.mark_sla_first_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.column_id IS DISTINCT FROM OLD.column_id AND NEW.sla_first_response_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM ticket_columns
      WHERE id = NEW.column_id AND triggers_sla_response_at = true
    ) THEN
      NEW.sla_first_response_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;