-- Fix triggers and foreign key constraints for multi-store architecture

-- 1. Fix stock_movements foreign key to point to product_templates instead of products_backup_old
ALTER TABLE stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;

ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_product_id_fkey
FOREIGN KEY (product_id) REFERENCES product_templates(id) ON DELETE CASCADE;

-- 2. Remove the automatic stock movement trigger on product_inventory
-- This trigger conflicts with the sales/purchases triggers that create stock movements
-- with proper user context
DROP TRIGGER IF EXISTS auto_create_stock_movement_on_inventory ON product_inventory;
DROP FUNCTION IF EXISTS create_stock_movement_on_inventory_update();

-- Note: The deduct_inventory_on_sale and restore_inventory_on_refund triggers
-- are already in place from migration 20251119152937_fix_stock_movements_trigger.sql
-- and will now work correctly with the fixed foreign key constraint
