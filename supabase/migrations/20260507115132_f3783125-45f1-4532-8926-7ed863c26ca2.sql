CREATE TABLE demand_relationships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id         UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  related_demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('blocks', 'related', 'linked')),
  created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_demand_relationship UNIQUE (demand_id, related_demand_id, relationship_type),
  CONSTRAINT chk_no_self_relation CHECK (demand_id != related_demand_id)
);

CREATE INDEX idx_demand_rel_demand  ON demand_relationships(demand_id);
CREATE INDEX idx_demand_rel_related ON demand_relationships(related_demand_id);
CREATE INDEX idx_demand_rel_type    ON demand_relationships(relationship_type);

ALTER TABLE demand_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demand_rel_select" ON demand_relationships FOR SELECT USING (
  demand_id IN (
    SELECT d.id FROM demands d
    WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
  )
);

CREATE POLICY "demand_rel_insert" ON demand_relationships FOR INSERT
  WITH CHECK (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY "demand_rel_delete" ON demand_relationships FOR DELETE
  USING (
    demand_id IN (
      SELECT d.id FROM demands d
      WHERE d.client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

COMMENT ON TABLE demand_relationships IS
  'Relações entre demandas: blocks (antecessora/dependente), related (complementar), linked (relativa/contexto).';

COMMENT ON COLUMN demand_relationships.relationship_type IS
  'blocks: demand_id deve concluir antes de related_demand_id iniciar (hard block).
   related: complementares — se influenciam mas não bloqueiam.
   linked: contexto compartilhado — apenas referência informativa.';

CREATE OR REPLACE FUNCTION enforce_demand_block_relationship()
RETURNS TRIGGER AS $$
DECLARE
  v_predecessor_finished TIMESTAMPTZ;
  v_predecessor_title    TEXT;
BEGIN
  IF NEW.relationship_type = 'blocks' THEN
    SELECT finished_at, title
    INTO v_predecessor_finished, v_predecessor_title
    FROM demands WHERE id = NEW.demand_id;

    IF v_predecessor_finished IS NULL THEN
      UPDATE demands
      SET
        is_blocked     = true,
        blocker_reason = 'Aguardando conclusão de: ' || v_predecessor_title,
        last_updated   = now()
      WHERE id = NEW.related_demand_id
        AND (is_blocked = false OR is_blocked IS NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_demand_block_on_relationship
  AFTER INSERT ON demand_relationships
  FOR EACH ROW EXECUTE FUNCTION enforce_demand_block_relationship();

CREATE OR REPLACE FUNCTION auto_unblock_dependent_demands()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.finished_at IS NOT NULL AND OLD.finished_at IS NULL THEN
    UPDATE demands dep
    SET
      is_blocked     = false,
      blocker_reason = NULL,
      last_updated   = now()
    WHERE dep.id IN (
      SELECT related_demand_id FROM demand_relationships
      WHERE demand_id          = NEW.id
        AND relationship_type  = 'blocks'
    )
    AND dep.blocker_reason LIKE 'Aguardando conclusão de:%';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auto_unblock_dependents
  AFTER UPDATE OF finished_at ON demands
  FOR EACH ROW EXECUTE FUNCTION auto_unblock_dependent_demands();

CREATE OR REPLACE FUNCTION get_demand_relationships(p_demand_id UUID)
RETURNS JSON
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'blocks_these', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',          d.id,
        'title',       d.title,
        'status',      CASE WHEN d.finished_at IS NOT NULL THEN 'done'
                            WHEN d.is_blocked THEN 'blocked'
                            ELSE 'active' END,
        'is_blocked',  d.is_blocked,
        'finished_at', d.finished_at
      )), '[]'::json)
      FROM demand_relationships dr
      JOIN demands d ON d.id = dr.related_demand_id
      WHERE dr.demand_id = p_demand_id AND dr.relationship_type = 'blocks'
    ),
    'blocked_by', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',          d.id,
        'title',       d.title,
        'finished_at', d.finished_at,
        'is_blocked',  d.is_blocked
      )), '[]'::json)
      FROM demand_relationships dr
      JOIN demands d ON d.id = dr.demand_id
      WHERE dr.related_demand_id = p_demand_id AND dr.relationship_type = 'blocks'
    ),
    'related', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',    d.id,
        'title', d.title,
        'type',  dr.relationship_type
      )), '[]'::json)
      FROM demand_relationships dr
      JOIN demands d ON d.id = CASE
        WHEN dr.demand_id = p_demand_id THEN dr.related_demand_id
        ELSE dr.demand_id END
      WHERE (dr.demand_id = p_demand_id OR dr.related_demand_id = p_demand_id)
        AND dr.relationship_type IN ('related', 'linked')
    )
  );
$$;