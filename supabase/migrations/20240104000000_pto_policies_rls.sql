-- Enable RLS on pto_policies table
ALTER TABLE pto_policies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view PTO policies in their organization
CREATE POLICY "Users can view PTO policies in their organization"
  ON pto_policies FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Policy: Admins and owners can insert PTO policies
CREATE POLICY "Admins can insert PTO policies"
  ON pto_policies FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );

-- Policy: Admins and owners can update PTO policies
CREATE POLICY "Admins can update PTO policies"
  ON pto_policies FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );

-- Policy: Admins and owners can delete PTO policies
CREATE POLICY "Admins can delete PTO policies"
  ON pto_policies FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );
