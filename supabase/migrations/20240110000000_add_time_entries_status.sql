-- Add status column to time_entries table for tracking approval status
-- This enables bulk approve/reject functionality in the Timesheets table

ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Add check constraint for valid status values
ALTER TABLE time_entries
ADD CONSTRAINT time_entries_status_check
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
