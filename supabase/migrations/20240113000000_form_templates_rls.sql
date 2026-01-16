-- RLS policies for form_templates table

-- Users can view form templates in their organization
CREATE POLICY "Users can view form templates in their organization"
ON public.form_templates
FOR SELECT
USING (organization_id = get_user_organization_id());

-- Admins and managers can create form templates
CREATE POLICY "Admins and managers can create form templates"
ON public.form_templates
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);

-- Admins and managers can update form templates
CREATE POLICY "Admins and managers can update form templates"
ON public.form_templates
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);

-- Admins and managers can delete form templates
CREATE POLICY "Admins and managers can delete form templates"
ON public.form_templates
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);
