-- Allow admins to update clients they have access to
CREATE POLICY "clients_update"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  id IN (SELECT user_accessible_client_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM user_client_access
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  id IN (SELECT user_accessible_client_ids(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM user_client_access
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);