-- Enable RLS on pto_balances table
ALTER TABLE pto_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own PTO balances
CREATE POLICY "Users can view their own PTO balances"
  ON pto_balances FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

-- Policy: Admins and managers can view PTO balances in their organization
CREATE POLICY "Admins and managers can view PTO balances in their organization"
  ON pto_balances FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND is_user_manager_or_admin()
  );

-- Policy: Admins and owners can insert PTO balances
CREATE POLICY "Admins can insert PTO balances"
  ON pto_balances FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );

-- Policy: Admins and owners can update PTO balances
CREATE POLICY "Admins can update PTO balances"
  ON pto_balances FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );

-- Policy: Admins and owners can delete PTO balances
CREATE POLICY "Admins can delete PTO balances"
  ON pto_balances FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );
