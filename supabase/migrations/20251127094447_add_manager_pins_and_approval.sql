-- Migration: Add manager PINs table and approval columns for cash sessions
-- This enables manager/admin validation when closing cash sessions with discrepancies

-- ============================================================================
-- 1. Create manager_pins table for storing hashed PINs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manager_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,  -- PIN hashed with bcrypt
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Comment on table
COMMENT ON TABLE public.manager_pins IS 'Stores hashed PINs for managers/admins used to approve cash session discrepancies';
COMMENT ON COLUMN public.manager_pins.pin_hash IS 'bcrypt hashed 6-digit PIN code';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_manager_pins_user_id ON public.manager_pins(user_id);

-- Enable RLS
ALTER TABLE public.manager_pins ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own PIN
CREATE POLICY "Users can view their own PIN record"
  ON public.manager_pins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own PIN"
  ON public.manager_pins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own PIN"
  ON public.manager_pins FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own PIN"
  ON public.manager_pins FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_manager_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_manager_pins_updated_at ON public.manager_pins;
CREATE TRIGGER update_manager_pins_updated_at
  BEFORE UPDATE ON public.manager_pins
  FOR EACH ROW
  EXECUTE FUNCTION update_manager_pins_updated_at();

-- ============================================================================
-- 2. Add approval columns to cash_sessions table
-- ============================================================================

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

-- Comments
COMMENT ON COLUMN public.cash_sessions.approved_by IS 'Manager/Admin who approved the session closure with discrepancy';
COMMENT ON COLUMN public.cash_sessions.approved_at IS 'Timestamp when the discrepancy was approved';
COMMENT ON COLUMN public.cash_sessions.requires_approval IS 'Whether this session had a discrepancy requiring approval';

-- Index for approval queries
CREATE INDEX IF NOT EXISTS idx_cash_sessions_approved_by ON public.cash_sessions(approved_by);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_requires_approval ON public.cash_sessions(requires_approval) WHERE requires_approval = true;

-- ============================================================================
-- 3. Function to check if a user has a PIN configured (for dropdown filtering)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_pin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_pins WHERE user_id = user_uuid
  );
$$;

COMMENT ON FUNCTION public.user_has_pin IS 'Check if a user has configured their approval PIN';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_pin TO authenticated;
