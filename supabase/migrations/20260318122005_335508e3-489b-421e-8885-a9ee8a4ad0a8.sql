
CREATE TABLE demand_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  active BOOLEAN DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE demand_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_areas_select ON demand_areas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY demand_areas_manage ON demand_areas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
