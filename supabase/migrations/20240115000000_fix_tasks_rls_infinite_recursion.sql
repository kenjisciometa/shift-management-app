-- Fix infinite recursion in tasks and task_assignments RLS policies
-- The original policies had circular references between tasks and task_assignments

-- Drop existing policies on tasks table
DROP POLICY IF EXISTS "Users can view tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in their organization" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;

-- Drop existing policies on task_assignments table
DROP POLICY IF EXISTS "Users can view task assignments in their organization" ON public.task_assignments;
DROP POLICY IF EXISTS "Users can create task assignments" ON public.task_assignments;
DROP POLICY IF EXISTS "Users can delete task assignments" ON public.task_assignments;

-- Recreate tasks policies without circular references
-- SELECT: All org members can view tasks
CREATE POLICY "Users can view tasks in their organization"
ON public.tasks
FOR SELECT
USING (organization_id = get_user_organization_id());

-- INSERT: All org members can create tasks
CREATE POLICY "Users can create tasks in their organization"
ON public.tasks
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- UPDATE: Admin/manager can update all, users can update their own tasks
CREATE POLICY "Users can update tasks"
ON public.tasks
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (is_user_manager_or_admin() OR created_by = auth.uid())
)
WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: Only admin/manager can delete
CREATE POLICY "Admins can delete tasks"
ON public.tasks
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND is_user_manager_or_admin()
);

-- Recreate task_assignments policies without referencing tasks table
-- SELECT: Users can view their own assignments, managers/admins can view all
CREATE POLICY "Users can view task assignments"
ON public.task_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_user_manager_or_admin()
);

-- INSERT: Managers/admins can create assignments, or users can assign themselves
CREATE POLICY "Users can create task assignments"
ON public.task_assignments
FOR INSERT
WITH CHECK (
  is_user_manager_or_admin()
  OR user_id = auth.uid()
);

-- DELETE: Managers/admins can delete, or users can remove themselves
CREATE POLICY "Users can delete task assignments"
ON public.task_assignments
FOR DELETE
USING (
  is_user_manager_or_admin()
  OR user_id = auth.uid()
);
