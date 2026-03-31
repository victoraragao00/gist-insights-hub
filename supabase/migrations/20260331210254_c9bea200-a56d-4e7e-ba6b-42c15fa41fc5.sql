
-- =========================================
-- 1. STATUS CONFIGURÁVEIS
-- =========================================

CREATE TABLE public.rfi_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  position integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rfi_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY rfi_statuses_select ON rfi_statuses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY rfi_statuses_manage ON rfi_statuses
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO rfi_statuses (name, color, position) VALUES
  ('Previsto', '#3b82f6', 0),
  ('Orçada', '#f59e0b', 1),
  ('Aceito', '#22c55e', 2),
  ('Recusada', '#ef4444', 3);

-- =========================================
-- 2. SEQUENCE PARA NUMERAÇÃO
-- =========================================

CREATE SEQUENCE public.rfi_number_seq START WITH 1 INCREMENT BY 1;

-- =========================================
-- 3. TABELA PRINCIPAL RFIs
-- =========================================

CREATE TABLE public.rfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL UNIQUE REFERENCES demands(id) ON DELETE CASCADE,
  status_id uuid REFERENCES rfi_statuses(id),
  assignee_id uuid REFERENCES user_profiles(id),
  subject text,
  description text,
  link text,
  due_date date,
  budget_value numeric(12,2),
  rfi_seq_number bigint NOT NULL UNIQUE,
  rfi_number text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 4. TRIGGER PARA NUMERAÇÃO
-- =========================================

CREATE OR REPLACE FUNCTION public.generate_rfi_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq bigint;
BEGIN
  seq := nextval('rfi_number_seq');
  NEW.rfi_seq_number := seq;
  NEW.rfi_number := 'RFI-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_rfi_number
  BEFORE INSERT ON public.rfis
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_rfi_number();

-- =========================================
-- 5. RLS (SEGURANÇA)
-- =========================================

CREATE POLICY rfis_select ON rfis
  FOR SELECT TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY rfis_insert ON rfis
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY rfis_update ON rfis
  FOR UPDATE TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

CREATE POLICY rfis_delete ON rfis
  FOR DELETE TO authenticated
  USING (
    demand_id IN (
      SELECT id FROM demands
      WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    )
  );

-- =========================================
-- 6. ÍNDICES
-- =========================================

CREATE INDEX idx_rfis_demand_id ON rfis(demand_id);
CREATE INDEX idx_rfis_status_id ON rfis(status_id);

-- =========================================
-- 7. MIGRAÇÃO DE DADOS ANTIGOS
-- =========================================

INSERT INTO rfis (demand_id, link, created_by, rfi_seq_number, rfi_number)
SELECT 
  d.id,
  d.rfi_url,
  COALESCE(d.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
  nextval('rfi_number_seq'),
  'RFI-' || lpad(nextval('rfi_number_seq')::text, 4, '0')
FROM demands d
WHERE d.rfi_url IS NOT NULL
  AND d.rfi_url != '';

-- =========================================
-- 8. REMOVER CAMPO LEGADO
-- =========================================

ALTER TABLE demands DROP COLUMN rfi_url;
