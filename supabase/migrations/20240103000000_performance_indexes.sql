-- Performance optimization: Add composite indexes for slow queries
-- This migration adds indexes to improve query performance on timesheets, time_entries, and pto_requests

-- Timesheets indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_user_period ON timesheets(user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_timesheets_org_status_submitted ON timesheets(organization_id, status, submitted_at DESC);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_user_timestamp ON time_entries(user_id, timestamp);

-- PTO requests indexes
CREATE INDEX IF NOT EXISTS idx_pto_requests_org_status_created ON pto_requests(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pto_requests_org_status_start_date ON pto_requests(organization_id, status, start_date);
CREATE INDEX IF NOT EXISTS idx_pto_requests_user_org_created ON pto_requests(user_id, organization_id, created_at DESC);

-- PTO balances indexes
CREATE INDEX IF NOT EXISTS idx_pto_balances_user_org_year ON pto_balances(user_id, organization_id, year);

-- PTO policies indexes
CREATE INDEX IF NOT EXISTS idx_pto_policies_org_active ON pto_policies(organization_id, is_active, pto_type);
