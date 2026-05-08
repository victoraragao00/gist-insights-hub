-- Update project_backlog_items status to 4 new values
ALTER TABLE public.project_backlog_items DROP CONSTRAINT IF EXISTS project_backlog_items_status_check;

UPDATE public.project_backlog_items SET status = 'aguardando_priorizacao' WHERE status = 'open';
UPDATE public.project_backlog_items SET status = 'aberto' WHERE status = 'converted';
UPDATE public.project_backlog_items SET status = 'cancelado' WHERE status = 'discarded';

ALTER TABLE public.project_backlog_items
  ALTER COLUMN status SET DEFAULT 'aguardando_priorizacao';

ALTER TABLE public.project_backlog_items
  ADD CONSTRAINT project_backlog_items_status_check
  CHECK (status IN ('aguardando_priorizacao', 'aberto', 'concluido', 'cancelado'));