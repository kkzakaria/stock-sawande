-- Add 'locked' status to cash_session_status enum
ALTER TYPE cash_session_status ADD VALUE IF NOT EXISTS 'locked';

-- Add columns for tracking lock state
ALTER TABLE cash_sessions
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES profiles(id);

-- Add index for querying locked sessions
CREATE INDEX IF NOT EXISTS idx_cash_sessions_locked_by ON cash_sessions(locked_by) WHERE locked_by IS NOT NULL;
