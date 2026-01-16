-- RLS policies for checklist_assignments table

-- Enable RLS if not already enabled
ALTER TABLE public.checklist_assignments ENABLE ROW LEVEL SECURITY;

-- Users can view their own assignments
CREATE POLICY "Users can view own checklist assignments"
ON public.checklist_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_user_manager_or_admin()
);

-- Admins and managers can create assignments
CREATE POLICY "Admins and managers can create checklist assignments"
ON public.checklist_assignments
FOR INSERT
WITH CHECK (is_user_manager_or_admin());

-- Users can update their own assignments (for completing checklist items)
CREATE POLICY "Users can update own checklist assignments"
ON public.checklist_assignments
FOR UPDATE
USING (user_id = auth.uid() OR is_user_manager_or_admin())
WITH CHECK (user_id = auth.uid() OR is_user_manager_or_admin());

-- Admins and managers can delete assignments
CREATE POLICY "Admins and managers can delete checklist assignments"
ON public.checklist_assignments
FOR DELETE
USING (is_user_manager_or_admin());
