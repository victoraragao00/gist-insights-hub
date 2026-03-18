
CREATE TABLE demand_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'link')),
  url TEXT NOT NULL,
  filename TEXT,
  size_bytes INTEGER,
  mime_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demand_attachments_demand ON demand_attachments(demand_id);

ALTER TABLE demand_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_attachments_select ON demand_attachments
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_attachments_insert ON demand_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_attachments_delete ON demand_attachments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());
