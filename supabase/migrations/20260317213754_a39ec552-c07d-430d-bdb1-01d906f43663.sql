
-- ============================================================
-- ENUMs
-- ============================================================

CREATE TYPE demand_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE demand_event_type AS ENUM (
  'created', 'moved', 'assigned', 'blocked', 'unblocked',
  'edited', 'cancelled', 'linked_interaction'
);

-- ============================================================
-- TABELAS
-- ============================================================

CREATE TABLE ticket_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT,
  triggers_started_at BOOLEAN DEFAULT false,
  triggers_finished_at BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE demand_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  active BOOLEAN DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  expected_result TEXT,
  client_id UUID REFERENCES clients(id) NOT NULL,
  demand_type_id UUID REFERENCES demand_types(id) NOT NULL,
  priority demand_priority NOT NULL DEFAULT 'medium',
  column_id UUID REFERENCES ticket_columns(id) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  assignee TEXT,
  notes TEXT,
  is_blocked BOOLEAN DEFAULT false,
  blocker_reason TEXT,
  blocked_by TEXT,
  blocked_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  estimated_effort TEXT,
  actual_effort TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE demand_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  event_type demand_event_type NOT NULL,
  description TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_demands_client ON demands(client_id, created_at DESC);
CREATE INDEX idx_demands_column ON demands(column_id, position);
CREATE INDEX idx_demands_priority ON demands(priority);
CREATE INDEX idx_demand_activities_demand ON demand_activities(demand_id, created_at DESC);

-- ============================================================
-- TRIGGER: atualizar last_updated automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION update_demand_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER demands_last_updated
  BEFORE UPDATE ON demands
  FOR EACH ROW EXECUTE FUNCTION update_demand_last_updated();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE ticket_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_activities ENABLE ROW LEVEL SECURITY;

-- ticket_columns: todos os autenticados leem
CREATE POLICY ticket_columns_select ON ticket_columns
  FOR SELECT TO authenticated USING (true);

-- ticket_columns: apenas admins gerenciam
CREATE POLICY ticket_columns_manage ON ticket_columns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- demand_types: todos leem
CREATE POLICY demand_types_select ON demand_types
  FOR SELECT TO authenticated USING (true);

-- demand_types: apenas admins gerenciam
CREATE POLICY demand_types_manage ON demand_types
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- demands: acesso via user_accessible_client_ids()
CREATE POLICY demands_select ON demands
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT user_accessible_client_ids(auth.uid())));

CREATE POLICY demands_insert ON demands
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT user_accessible_client_ids(auth.uid())));

CREATE POLICY demands_update ON demands
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT user_accessible_client_ids(auth.uid())));

CREATE POLICY demands_delete ON demands
  FOR DELETE TO authenticated
  USING (client_id IN (SELECT user_accessible_client_ids(auth.uid())));

-- demand_activities: acesso via demands
CREATE POLICY demand_activities_select ON demand_activities
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_activities_insert ON demand_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );
