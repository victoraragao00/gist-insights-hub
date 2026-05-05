-- Tabela projects
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  owner_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  due_date      DATE,
  cancelled_at  TIMESTAMPTZ,
  cancelled_by  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  workspace     TEXT NOT NULL DEFAULT 'tech'
                  CHECK (workspace IN ('tech', 'cx', 'both')),
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_owner    ON projects(owner_id);
CREATE INDEX idx_projects_workspace ON projects(workspace);
CREATE INDEX idx_projects_client   ON projects(client_id) WHERE client_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_projects_updated_at();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Tabela project_members (criada antes das policies que a referenciam)
CREATE TABLE project_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member'
                 CHECK (role IN ('owner', 'member')),
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user    ON project_members(user_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policies projects
CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  owner_id = auth.uid()
  OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
);

CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "projects_delete" ON projects FOR DELETE
  USING (owner_id = auth.uid());

-- Policies project_members
CREATE POLICY "project_members_select" ON project_members FOR SELECT USING (
  project_id IN (
    SELECT id FROM projects
    WHERE owner_id = auth.uid()
       OR id IN (SELECT project_id FROM project_members pm2 WHERE pm2.user_id = auth.uid())
  )
);

CREATE POLICY "project_members_insert" ON project_members FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

CREATE POLICY "project_members_delete" ON project_members FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid()));

COMMENT ON TABLE projects IS 'Projetos do workspace TECH. Status é computado via get_project_stats — nunca armazenado.';
COMMENT ON COLUMN projects.cancelled_at IS 'NULL = projeto ativo. Preenchido = cancelado. Único estado manual.';
COMMENT ON TABLE project_members IS 'Squad do projeto — membros via user_profiles. UNIQUE por (project_id, user_id).';

-- demands.project_id
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS project_id UUID
    REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX idx_demands_project ON demands(project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN demands.project_id IS
  'FK nullable para projects. Uma demanda pertence a no máximo 1 projeto.';

-- get_project_stats
CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project        projects%ROWTYPE;
  v_total          INT;
  v_completed      INT;
  v_completion_pct NUMERIC;
  v_overdue_count  INT;
  v_total_hours    NUMERIC;
  v_status         TEXT;
  v_by_column      JSON;
BEGIN
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  IF v_project.owner_id != auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM project_members
       WHERE project_id = p_project_id AND user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM demands WHERE project_id = p_project_id;

  SELECT COUNT(*) INTO v_completed
    FROM demands d
    JOIN ticket_columns tc ON tc.id = d.column_id
    WHERE d.project_id = p_project_id
      AND tc.triggers_finished_at = true
      AND d.cancellation_reason IS NULL;

  v_completion_pct := CASE
    WHEN v_total = 0 THEN 0
    ELSE ROUND((v_completed::NUMERIC / v_total) * 100, 1)
  END;

  IF v_project.due_date IS NOT NULL THEN
    SELECT COUNT(*) INTO v_overdue_count
      FROM demands d
      WHERE d.project_id = p_project_id
        AND d.cancellation_reason IS NULL
        AND d.finished_at IS NULL
        AND d.created_at::DATE > v_project.due_date;
  ELSE
    v_overdue_count := 0;
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN dte.hours_manual IS NOT NULL THEN dte.hours_manual
      WHEN dte.started_at IS NOT NULL AND dte.ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (dte.ended_at - dte.started_at)) / 3600.0
      ELSE 0
    END
  ), 0) INTO v_total_hours
  FROM demand_time_entries dte
  JOIN demands d ON d.id = dte.demand_id
  WHERE d.project_id = p_project_id;

  SELECT json_agg(json_build_object(
    'column_id', tc.id,
    'column_name', tc.name,
    'count', col_counts.cnt
  )) INTO v_by_column
  FROM (
    SELECT d.column_id, COUNT(*) as cnt
    FROM demands d
    WHERE d.project_id = p_project_id
    GROUP BY d.column_id
  ) col_counts
  JOIN ticket_columns tc ON tc.id = col_counts.column_id;

  v_status := CASE
    WHEN v_project.cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN v_total = 0 THEN 'planning'
    WHEN v_completion_pct = 100 THEN 'completed'
    WHEN v_completion_pct > 0 THEN 'active'
    ELSE 'planning'
  END;

  RETURN json_build_object(
    'project_id',      p_project_id,
    'status',          v_status,
    'total_demands',   v_total,
    'completed',       v_completed,
    'completion_pct',  v_completion_pct,
    'overdue_count',   v_overdue_count,
    'total_hours',     v_total_hours,
    'by_column',       COALESCE(v_by_column, '[]'::json)
  );
END;
$$;

-- cancel_project
CREATE OR REPLACE FUNCTION cancel_project(
  p_project_id UUID,
  p_reason     TEXT DEFAULT 'Projeto cancelado'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT owner_id INTO v_owner_id
    FROM projects WHERE id = p_project_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Apenas o owner pode cancelar o projeto';
  END IF;

  UPDATE projects
    SET cancelled_at = now(),
        cancelled_by = auth.uid(),
        updated_at   = now()
  WHERE id = p_project_id;

  UPDATE demands
    SET cancellation_reason = p_reason,
        last_updated        = now()
  WHERE project_id          = p_project_id
    AND finished_at         IS NULL
    AND cancellation_reason IS NULL;
END;
$$;

COMMENT ON FUNCTION cancel_project IS
  'Cancela o projeto e todas as demandas ativas. Só o owner pode executar. Preserva demandas já concluídas ou já canceladas.';