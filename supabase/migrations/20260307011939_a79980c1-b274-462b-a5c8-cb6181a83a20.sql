
CREATE POLICY "app_settings_update_admin" ON app_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
