-- RLS policies for checklists table

-- Users can view checklists in their organization
CREATE POLICY "Users can view checklists in their organization"
ON public.checklists
FOR SELECT
USING (organization_id = get_user_organization_id());

-- Admins and managers can create checklists
CREATE POLICY "Admins and managers can create checklists"
ON public.checklists
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);

-- Admins and managers can update checklists
CREATE POLICY "Admins and managers can update checklists"
ON public.checklists
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);

-- Admins and managers can delete checklists
CREATE POLICY "Admins and managers can delete checklists"
ON public.checklists
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);
