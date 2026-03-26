
-- SA-1: Meeting Agendas module tables

-- 1. meeting_agendas
CREATE TABLE public.meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  title text NOT NULL,
  meeting_date timestamptz NOT NULL,
  location text,
  objective text,
  context_notes text,
  executive_summary text,
  transcription text,
  satisfaction_score smallint,
  next_steps text,
  ai_processed boolean DEFAULT false,
  ai_processed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. meeting_participants (junction: pauta <-> participants/user_profiles)
CREATE TABLE public.meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES meeting_agendas(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participants(id),
  user_profile_id uuid REFERENCES user_profiles(id),
  present boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_one_ref CHECK (
    (participant_id IS NOT NULL AND user_profile_id IS NULL)
    OR (participant_id IS NULL AND user_profile_id IS NOT NULL)
  )
);

-- 3. meeting_homework_items
CREATE TABLE public.meeting_homework_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES meeting_agendas(id) ON DELETE CASCADE,
  description text NOT NULL,
  responsible_side text NOT NULL DEFAULT 'client',
  responsible_label text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  converted_to_demand_id uuid REFERENCES demands(id),
  created_at timestamptz DEFAULT now()
);

-- 4. Indexes
CREATE INDEX idx_meeting_agendas_client ON meeting_agendas(client_id);
CREATE INDEX idx_meeting_agendas_date ON meeting_agendas(meeting_date DESC);
CREATE INDEX idx_meeting_homework_agenda ON meeting_homework_items(agenda_id);
CREATE INDEX idx_meeting_participants_agenda ON meeting_participants(agenda_id);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_meeting_agenda_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meeting_agenda_updated_at
  BEFORE UPDATE ON meeting_agendas
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_agenda_updated_at();

-- 6. RLS: meeting_agendas
ALTER TABLE meeting_agendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_agendas_select" ON meeting_agendas
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT user_accessible_client_ids(auth.uid())));

CREATE POLICY "meeting_agendas_insert" ON meeting_agendas
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT user_accessible_client_ids(auth.uid())));

CREATE POLICY "meeting_agendas_update" ON meeting_agendas
  FOR UPDATE TO authenticated
  USING (
    is_admin() OR created_by = auth.uid()
  );

CREATE POLICY "meeting_agendas_delete" ON meeting_agendas
  FOR DELETE TO authenticated
  USING (
    is_admin() OR created_by = auth.uid()
  );

-- 7. RLS: meeting_participants
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_participants_select" ON meeting_participants
  FOR SELECT TO authenticated
  USING (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

CREATE POLICY "meeting_participants_insert" ON meeting_participants
  FOR INSERT TO authenticated
  WITH CHECK (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

CREATE POLICY "meeting_participants_delete" ON meeting_participants
  FOR DELETE TO authenticated
  USING (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

-- 8. RLS: meeting_homework_items
ALTER TABLE meeting_homework_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_homework_select" ON meeting_homework_items
  FOR SELECT TO authenticated
  USING (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

CREATE POLICY "meeting_homework_insert" ON meeting_homework_items
  FOR INSERT TO authenticated
  WITH CHECK (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

CREATE POLICY "meeting_homework_update" ON meeting_homework_items
  FOR UPDATE TO authenticated
  USING (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

CREATE POLICY "meeting_homework_delete" ON meeting_homework_items
  FOR DELETE TO authenticated
  USING (agenda_id IN (SELECT id FROM meeting_agendas WHERE client_id IN (SELECT user_accessible_client_ids(auth.uid()))));

-- 9. Seed agenda_required_fields config
INSERT INTO app_settings (key, value)
VALUES ('agenda_required_fields', '{"title":"required","meeting_date":"required","client_id":"required","objective":"required","context_notes":"optional","satisfaction_score":"required","next_steps":"optional","transcription":"optional","location":"optional"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 10. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_agendas;
