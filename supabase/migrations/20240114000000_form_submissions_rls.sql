-- RLS policies for form_submissions table

-- Users can view their own submissions, managers/admins can view all in org
CREATE POLICY "Users can view form submissions"
ON public.form_submissions
FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (user_id = auth.uid() OR is_user_manager_or_admin())
);

-- Users can create their own submissions
CREATE POLICY "Users can create own form submissions"
ON public.form_submissions
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND user_id = auth.uid()
);

-- Users can update their own submissions (before finalizing)
CREATE POLICY "Users can update own form submissions"
ON public.form_submissions
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (user_id = auth.uid() OR is_user_manager_or_admin())
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (user_id = auth.uid() OR is_user_manager_or_admin())
);

-- Admins and managers can delete submissions
CREATE POLICY "Admins and managers can delete form submissions"
ON public.form_submissions
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);
