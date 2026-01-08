-- Create positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_positions_organization_id ON positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_positions_is_active ON positions(is_active);

-- Add unique constraint for name within organization
ALTER TABLE positions ADD CONSTRAINT positions_name_org_unique UNIQUE (organization_id, name);

-- Enable RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view positions in their organization"
  ON positions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage positions"
  ON positions FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_user_admin()
  );

-- Add position_id to shifts table (optional foreign key to positions)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;

-- Add position_id to shift_templates table
ALTER TABLE shift_templates ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id) ON DELETE SET NULL;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_positions_updated_at();
