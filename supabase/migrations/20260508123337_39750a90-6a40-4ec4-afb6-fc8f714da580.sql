
CREATE OR REPLACE FUNCTION public.update_project_child_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  description text,
  url text,
  file_path text,
  file_name text,
  file_size_bytes bigint,
  mime_type text,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_documents_project ON public.project_documents(project_id);
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_documents_select" ON public.project_documents
  FOR SELECT USING (public.is_project_accessible(project_id));
CREATE POLICY "project_documents_insert" ON public.project_documents
  FOR INSERT WITH CHECK (public.is_project_accessible(project_id) AND created_by = auth.uid());
CREATE POLICY "project_documents_update" ON public.project_documents
  FOR UPDATE USING (public.is_project_accessible(project_id));
CREATE POLICY "project_documents_delete" ON public.project_documents
  FOR DELETE USING (public.is_project_accessible(project_id));

CREATE TRIGGER trg_project_documents_updated_at
  BEFORE UPDATE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_project_child_updated_at();

CREATE TABLE public.project_backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','converted','discarded')),
  position integer NOT NULL DEFAULT 0,
  converted_demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_backlog_project ON public.project_backlog_items(project_id);
CREATE INDEX idx_project_backlog_status ON public.project_backlog_items(project_id, status, position);
ALTER TABLE public.project_backlog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_backlog_select" ON public.project_backlog_items
  FOR SELECT USING (public.is_project_accessible(project_id));
CREATE POLICY "project_backlog_insert" ON public.project_backlog_items
  FOR INSERT WITH CHECK (public.is_project_accessible(project_id) AND created_by = auth.uid());
CREATE POLICY "project_backlog_update" ON public.project_backlog_items
  FOR UPDATE USING (public.is_project_accessible(project_id));
CREATE POLICY "project_backlog_delete" ON public.project_backlog_items
  FOR DELETE USING (public.is_project_accessible(project_id));

CREATE TRIGGER trg_project_backlog_updated_at
  BEFORE UPDATE ON public.project_backlog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_project_child_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_docs_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-documents' AND auth.role() = 'authenticated');
CREATE POLICY "project_docs_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'project-documents' AND auth.role() = 'authenticated');
CREATE POLICY "project_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'project-documents' AND auth.role() = 'authenticated');
