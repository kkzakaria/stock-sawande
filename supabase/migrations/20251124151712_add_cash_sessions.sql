-- Migration: Add Cash Drawer Session Management
-- This migration creates the cash_sessions table for tracking cash drawer operations

-- Create cash_session_status enum for type safety
DO $$ BEGIN
  CREATE TYPE public.cash_session_status AS ENUM ('open', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create cash_sessions table
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Store and Cashier identification
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Opening session details
  opening_amount DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  opening_notes TEXT,

  -- Closing session details (null until closed)
  closing_amount DECIMAL(12, 2) CHECK (closing_amount >= 0),
  expected_closing_amount DECIMAL(12, 2) CHECK (expected_closing_amount >= 0),
  discrepancy DECIMAL(12, 2),
  closed_at TIMESTAMP WITH TIME ZONE,
  closing_notes TEXT,

  -- Status tracking
  status public.cash_session_status NOT NULL DEFAULT 'open',

  -- Summary counters (updated on each sale)
  total_cash_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_card_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_mobile_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_other_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  transaction_count INTEGER NOT NULL DEFAULT 0,

  -- Audit timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_id ON public.cash_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_cashier_id ON public.cash_sessions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON public.cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at ON public.cash_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_store_cashier_status ON public.cash_sessions(store_id, cashier_id, status);

-- Create unique partial index for one open session per cashier
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_session
  ON public.cash_sessions(store_id, cashier_id)
  WHERE status = 'open';

-- Enable Row Level Security
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view sessions from their store
CREATE POLICY "Users can view cash sessions from their store"
  ON public.cash_sessions FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

-- Cashiers can create sessions for themselves in their store
CREATE POLICY "Cashiers can create their own sessions"
  ON public.cash_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    cashier_id = auth.uid()
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Cashiers can update their own open sessions
CREATE POLICY "Users can update their own cash sessions"
  ON public.cash_sessions FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      store_id = (SELECT public.get_current_user_store_id())
      AND (
        (SELECT public.get_current_user_role()) IN ('manager')
        OR cashier_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      store_id = (SELECT public.get_current_user_store_id())
      AND (
        (SELECT public.get_current_user_role()) IN ('manager')
        OR cashier_id = auth.uid()
      )
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_cash_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_cash_sessions_updated_at ON public.cash_sessions;
CREATE TRIGGER update_cash_sessions_updated_at
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_sessions_updated_at();

-- Add cash_session_id to sales table for tracking
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES public.cash_sessions(id);

CREATE INDEX IF NOT EXISTS idx_sales_cash_session_id ON public.sales(cash_session_id);

-- Comments
COMMENT ON TABLE public.cash_sessions IS 'Cash drawer sessions for POS with opening/closing amounts';
COMMENT ON COLUMN public.cash_sessions.opening_amount IS 'Initial cash amount (fond de caisse)';
COMMENT ON COLUMN public.cash_sessions.closing_amount IS 'Final counted cash amount at close';
COMMENT ON COLUMN public.cash_sessions.expected_closing_amount IS 'Calculated expected cash: opening + cash_sales';
COMMENT ON COLUMN public.cash_sessions.discrepancy IS 'Difference: closing_amount - expected_closing_amount';
