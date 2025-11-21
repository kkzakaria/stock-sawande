-- Enable Realtime for product_inventory table
-- This allows multi-cashier POS synchronization in real-time

-- Add product_inventory table to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE product_inventory;

-- Comment explaining the purpose
COMMENT ON TABLE product_inventory IS 'Product inventory levels - Realtime enabled for multi-cashier POS synchronization';
