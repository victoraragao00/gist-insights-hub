ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS original_due_date DATE;

COMMENT ON COLUMN projects.original_due_date IS
  'Data de entrega original — preenchida automaticamente na primeira alteração de due_date. Nunca sobrescrita.';