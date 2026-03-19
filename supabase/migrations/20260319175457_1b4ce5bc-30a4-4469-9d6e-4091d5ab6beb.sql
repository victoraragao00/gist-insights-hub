
-- Adicionar 'commented' ao ENUM existente
ALTER TYPE demand_event_type ADD VALUE IF NOT EXISTS 'commented';

-- Tabela demand_interactions (vínculo conversa ↔ ticket)
CREATE TABLE IF NOT EXISTS demand_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  interaction_id UUID REFERENCES interactions(id) ON DELETE CASCADE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(demand_id, interaction_id)
);

CREATE INDEX IF NOT EXISTS idx_demand_interactions_demand ON demand_interactions(demand_id);
CREATE INDEX IF NOT EXISTS idx_demand_interactions_interaction ON demand_interactions(interaction_id);

ALTER TABLE demand_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_interactions_select ON demand_interactions
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_interactions_insert ON demand_interactions
  FOR INSERT TO authenticated
  WITH CHECK (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_interactions_delete ON demand_interactions
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Tabela demand_comments
CREATE TABLE IF NOT EXISTS demand_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demand_comments_demand ON demand_comments(demand_id, created_at ASC);

ALTER TABLE demand_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY demand_comments_select ON demand_comments
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_comments_insert ON demand_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY demand_comments_update ON demand_comments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY demand_comments_delete ON demand_comments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE demand_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE demand_interactions;

-- DB function: conversas por cliente
CREATE OR REPLACE FUNCTION get_client_conversations(p_client_id UUID)
RETURNS TABLE (
  conversation_id TEXT,
  message_count BIGINT,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_content TEXT,
  sender_side TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.conversation_id,
    COUNT(*) AS message_count,
    MIN(i.occurred_at) AS first_message_at,
    MAX(i.occurred_at) AS last_message_at,
    (
      SELECT content FROM interactions
      WHERE conversation_id = i.conversation_id AND client_id = p_client_id
      ORDER BY occurred_at DESC LIMIT 1
    ) AS last_content,
    (
      SELECT sender_side FROM interactions
      WHERE conversation_id = i.conversation_id AND client_id = p_client_id
      ORDER BY occurred_at DESC LIMIT 1
    ) AS sender_side
  FROM interactions i
  WHERE i.client_id = p_client_id
    AND i.conversation_id IS NOT NULL
    AND i.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  GROUP BY i.conversation_id
  ORDER BY MAX(i.occurred_at) DESC
  LIMIT 50;
$$;
