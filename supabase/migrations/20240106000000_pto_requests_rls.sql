-- Enable RLS on pto_requests table
ALTER TABLE pto_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own PTO requests
CREATE POLICY "Users can view their own PTO requests"
  ON pto_requests FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

-- Policy: Admins and managers can view PTO requests in their organization
CREATE POLICY "Admins and managers can view PTO requests in their organization"
  ON pto_requests FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND is_user_manager_or_admin()
  );

-- Policy: Users can create their own PTO requests
CREATE POLICY "Users can create their own PTO requests"
  ON pto_requests FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

-- Policy: Users can update their own pending PTO requests
CREATE POLICY "Users can update their own pending PTO requests"
  ON pto_requests FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  );

-- Policy: Admins and managers can review PTO requests in their organization
CREATE POLICY "Admins and managers can review PTO requests"
  ON pto_requests FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND is_user_manager_or_admin()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_user_manager_or_admin()
  );

-- Policy: Users can delete their own pending PTO requests
CREATE POLICY "Users can delete their own pending PTO requests"
  ON pto_requests FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  );

