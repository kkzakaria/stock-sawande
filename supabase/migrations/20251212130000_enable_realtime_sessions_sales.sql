-- Enable Realtime for cash_sessions and sales tables
-- This allows real-time dashboard updates and multi-cashier visibility

-- Add cash_sessions table to Realtime publication
-- Useful for: seeing when other cashiers open/close their registers
ALTER PUBLICATION supabase_realtime ADD TABLE cash_sessions;

-- Add sales table to Realtime publication
-- Useful for: real-time sales dashboard, manager oversight
ALTER PUBLICATION supabase_realtime ADD TABLE sales;

-- Comments explaining the purpose
COMMENT ON TABLE cash_sessions IS 'Cash register sessions - Realtime enabled for multi-cashier visibility';
COMMENT ON TABLE sales IS 'Sales transactions - Realtime enabled for dashboard updates';
