
-- Tabela de documentos por cliente
CREATE TABLE public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outro' CHECK (category IN ('contrato', 'proposta', 'apresentacao', 'outro')),
  description TEXT,
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  assignee_id UUID REFERENCES public.user_profiles(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select ON public.client_documents
  FOR SELECT USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY documents_insert ON public.client_documents
  FOR INSERT WITH CHECK (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY documents_update ON public.client_documents
  FOR UPDATE USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY documents_delete ON public.client_documents
  FOR DELETE USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  );

CREATE INDEX idx_client_documents_client ON public.client_documents(client_id);

-- Trigger updated_at for client_documents
CREATE OR REPLACE FUNCTION update_client_document_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_client_document_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION update_client_document_updated_at();

-- Tabela de regras extras por cliente
CREATE TABLE public.client_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_rules_select ON public.client_rules
  FOR SELECT USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY client_rules_insert ON public.client_rules
  FOR INSERT WITH CHECK (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY client_rules_update ON public.client_rules
  FOR UPDATE USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  );

CREATE POLICY client_rules_delete ON public.client_rules
  FOR DELETE USING (
    client_id IN (SELECT public.user_accessible_client_ids(auth.uid()))
  );

CREATE INDEX idx_client_rules_client ON public.client_rules(client_id);

-- Trigger updated_at for client_rules
CREATE OR REPLACE FUNCTION update_client_rule_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_client_rule_updated_at
  BEFORE UPDATE ON public.client_rules
  FOR EACH ROW EXECUTE FUNCTION update_client_rule_updated_at();

-- Storage bucket para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT DO NOTHING;

-- RLS Storage
CREATE POLICY "client_docs_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-documents' AND auth.role() = 'authenticated'
  );

CREATE POLICY "client_docs_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-documents' AND auth.role() = 'authenticated'
  );

CREATE POLICY "client_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-documents' AND auth.role() = 'authenticated'
  );
