
CREATE TABLE demand_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE demand_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_assignees_select ON demand_assignees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY demand_assignees_manage ON demand_assignees
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
