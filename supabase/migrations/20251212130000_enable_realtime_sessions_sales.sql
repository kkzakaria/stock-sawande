-- Enable Realtime for cash_sessions and sales tables
-- This allows real-time dashboard updates and multi-cashier visibility

-- Add tables to Realtime publication (only if not already added)
DO $$
BEGIN
  -- Add cash_sessions if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cash_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cash_sessions;
  END IF;

  -- Add sales if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sales;
  END IF;
END $$;

-- Comments explaining the purpose
COMMENT ON TABLE cash_sessions IS 'Cash register sessions - Realtime enabled for multi-cashier visibility';
COMMENT ON TABLE sales IS 'Sales transactions - Realtime enabled for dashboard updates';
