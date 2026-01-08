-- Audit Log Triggers
-- This migration adds database triggers to automatically log changes to key tables

-- Create a generic audit log function
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
  user_uuid UUID;
  action_name TEXT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  -- Determine the action
  IF TG_OP = 'INSERT' THEN
    action_name := 'create';
    old_data := NULL;
    new_data := to_jsonb(NEW);

    -- Try to get organization_id from new record
    IF NEW.organization_id IS NOT NULL THEN
      org_id := NEW.organization_id;
    END IF;

    -- Try to get user_id from new record
    IF NEW.user_id IS NOT NULL THEN
      user_uuid := NEW.user_id;
    ELSIF NEW.created_by IS NOT NULL THEN
      user_uuid := NEW.created_by;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'update';
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);

    -- Get organization_id from old or new record
    IF NEW.organization_id IS NOT NULL THEN
      org_id := NEW.organization_id;
    ELSIF OLD.organization_id IS NOT NULL THEN
      org_id := OLD.organization_id;
    END IF;

    -- Try to get user from updated_by or user_id
    IF NEW.updated_by IS NOT NULL THEN
      user_uuid := NEW.updated_by;
    ELSIF NEW.reviewed_by IS NOT NULL THEN
      user_uuid := NEW.reviewed_by;
    ELSIF NEW.user_id IS NOT NULL THEN
      user_uuid := NEW.user_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'delete';
    old_data := to_jsonb(OLD);
    new_data := NULL;

    -- Get organization_id from old record
    IF OLD.organization_id IS NOT NULL THEN
      org_id := OLD.organization_id;
    END IF;

    -- Try to get user_id from old record
    IF OLD.user_id IS NOT NULL THEN
      user_uuid := OLD.user_id;
    END IF;
  END IF;

  -- Only log if we have an organization_id
  IF org_id IS NOT NULL THEN
    INSERT INTO audit_logs (
      organization_id,
      user_id,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
      created_at
    ) VALUES (
      org_id,
      user_uuid,
      action_name,
      TG_TABLE_NAME,
      CASE
        WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
        ELSE NEW.id::TEXT
      END,
      old_data,
      new_data,
      NOW()
    );
  END IF;

  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for important tables

-- Shifts table
DROP TRIGGER IF EXISTS audit_shifts ON shifts;
CREATE TRIGGER audit_shifts
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- PTO Requests table
DROP TRIGGER IF EXISTS audit_pto_requests ON pto_requests;
CREATE TRIGGER audit_pto_requests
  AFTER INSERT OR UPDATE OR DELETE ON pto_requests
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Timesheets table
DROP TRIGGER IF EXISTS audit_timesheets ON timesheets;
CREATE TRIGGER audit_timesheets
  AFTER INSERT OR UPDATE OR DELETE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Profiles table
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Locations table
DROP TRIGGER IF EXISTS audit_locations ON locations;
CREATE TRIGGER audit_locations
  AFTER INSERT OR UPDATE OR DELETE ON locations
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Departments table
DROP TRIGGER IF EXISTS audit_departments ON departments;
CREATE TRIGGER audit_departments
  AFTER INSERT OR UPDATE OR DELETE ON departments
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Employee invitations table
DROP TRIGGER IF EXISTS audit_employee_invitations ON employee_invitations;
CREATE TRIGGER audit_employee_invitations
  AFTER INSERT OR UPDATE OR DELETE ON employee_invitations
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Tasks table
DROP TRIGGER IF EXISTS audit_tasks ON tasks;
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Form templates table
DROP TRIGGER IF EXISTS audit_form_templates ON form_templates;
CREATE TRIGGER audit_form_templates
  AFTER INSERT OR UPDATE OR DELETE ON form_templates
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Shift templates table
DROP TRIGGER IF EXISTS audit_shift_templates ON shift_templates;
CREATE TRIGGER audit_shift_templates
  AFTER INSERT OR UPDATE OR DELETE ON shift_templates
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- PTO policies table
DROP TRIGGER IF EXISTS audit_pto_policies ON pto_policies;
CREATE TRIGGER audit_pto_policies
  AFTER INSERT OR UPDATE OR DELETE ON pto_policies
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Organizations table (admin changes)
DROP TRIGGER IF EXISTS audit_organizations ON organizations;
CREATE TRIGGER audit_organizations
  AFTER UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION log_audit();

-- Comment explaining usage
COMMENT ON FUNCTION log_audit() IS 'Generic audit logging function that captures INSERT, UPDATE, and DELETE operations on monitored tables. Automatically extracts organization_id and user_id from records.';
