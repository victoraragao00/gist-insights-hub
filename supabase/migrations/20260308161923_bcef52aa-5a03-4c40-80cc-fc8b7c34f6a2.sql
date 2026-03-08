
-- S1: Fix audit_rules RLS — replace overly permissive ALL policy with granular ones

-- Drop existing ALL policy (too permissive — allows non-admins to write)
DROP POLICY IF EXISTS "audit_rules_access" ON audit_rules;

-- SELECT: user sees rules for accessible clients (or global rules where client_id IS NULL)
CREATE POLICY "audit_rules_select"
  ON audit_rules FOR SELECT
  TO authenticated
  USING (
    client_id IN (SELECT user_accessible_client_ids(auth.uid()))
    OR client_id IS NULL
  );

-- INSERT: admin only
CREATE POLICY "audit_rules_insert"
  ON audit_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    (client_id IN (SELECT user_accessible_client_ids(auth.uid())) OR client_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- UPDATE: admin only
CREATE POLICY "audit_rules_update"
  ON audit_rules FOR UPDATE
  TO authenticated
  USING (
    (client_id IN (SELECT user_accessible_client_ids(auth.uid())) OR client_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: admin only
CREATE POLICY "audit_rules_delete"
  ON audit_rules FOR DELETE
  TO authenticated
  USING (
    (client_id IN (SELECT user_accessible_client_ids(auth.uid())) OR client_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM user_client_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
