
CREATE TABLE demand_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('moved', 'assigned', 'created', 'commented')),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_demand_notifications_user ON demand_notifications(user_id, read, created_at DESC);

ALTER TABLE demand_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_notifications_select ON demand_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY demand_notifications_update ON demand_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
