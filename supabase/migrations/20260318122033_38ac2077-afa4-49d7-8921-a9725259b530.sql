
INSERT INTO storage.buckets (id, name, public)
VALUES ('demand-attachments', 'demand-attachments', false);

CREATE POLICY demand_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'demand-attachments');

CREATE POLICY demand_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'demand-attachments');

CREATE POLICY demand_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'demand-attachments');
