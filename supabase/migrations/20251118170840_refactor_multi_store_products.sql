-- Migration: Refactor to support products in multiple stores
-- This migration creates a new structure where products (templates) can be available
-- in multiple stores with independent inventory levels

-- Step 1: Create product_templates table (common product information)
CREATE TABLE IF NOT EXISTS public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  cost DECIMAL(10, 2) CHECK (cost >= 0),
  min_stock_level INTEGER DEFAULT 10 CHECK (min_stock_level >= 0),
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(sku),
  UNIQUE(barcode)
);

-- Step 2: Create product_inventory table (store-specific inventory)
CREATE TABLE IF NOT EXISTS public.product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.product_templates(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(product_id, store_id)
);

-- Step 3: Migrate existing data from products to new tables
-- First, migrate product information to product_templates
INSERT INTO public.product_templates (
  id,
  sku,
  name,
  description,
  category_id,
  price,
  cost,
  min_stock_level,
  image_url,
  barcode,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  sku,
  name,
  description,
  category_id,
  price,
  cost,
  min_stock_level,
  image_url,
  barcode,
  is_active,
  created_at,
  updated_at
FROM public.products
ON CONFLICT (id) DO NOTHING;

-- Second, migrate inventory to product_inventory
INSERT INTO public.product_inventory (
  product_id,
  store_id,
  quantity,
  created_at,
  updated_at
)
SELECT
  id,
  store_id,
  quantity,
  created_at,
  updated_at
FROM public.products
WHERE store_id IS NOT NULL
ON CONFLICT (product_id, store_id) DO NOTHING;

-- Step 4: Update stock_movements to reference product_inventory
-- Add new column for product_inventory reference
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES public.product_inventory(id) ON DELETE CASCADE;

-- Update existing stock_movements to reference the correct inventory
UPDATE public.stock_movements sm
SET inventory_id = pi.id
FROM public.product_inventory pi
WHERE sm.product_id = pi.product_id
  AND sm.store_id = pi.store_id
  AND sm.inventory_id IS NULL;

-- Step 5: Drop old triggers and functions related to products
DROP TRIGGER IF EXISTS auto_create_stock_movement ON public.products;
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS create_stock_movement_on_product_update ON public.products;
DROP FUNCTION IF EXISTS create_stock_movement_on_product_update() CASCADE;

-- Step 6: Rename old products table as backup (safer than dropping immediately)
ALTER TABLE public.products RENAME TO products_backup_old;

-- Step 7: Create indexes for performance
CREATE INDEX idx_product_templates_category_id ON public.product_templates(category_id);
CREATE INDEX idx_product_templates_sku ON public.product_templates(sku);
CREATE INDEX idx_product_templates_barcode ON public.product_templates(barcode);
CREATE INDEX idx_product_templates_is_active ON public.product_templates(is_active);
CREATE INDEX idx_product_inventory_product_id ON public.product_inventory(product_id);
CREATE INDEX idx_product_inventory_store_id ON public.product_inventory(store_id);
CREATE INDEX idx_product_inventory_product_store ON public.product_inventory(product_id, store_id);
CREATE INDEX idx_stock_movements_inventory_id ON public.stock_movements(inventory_id);

-- Step 8: Enable Row Level Security
ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_inventory ENABLE ROW LEVEL SECURITY;

-- Step 9: RLS Policies for product_templates
-- Anyone authenticated can view product templates
CREATE POLICY "Anyone can view product templates"
  ON public.product_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only admin and managers can insert product templates
CREATE POLICY "Admin and managers can insert product templates"
  ON public.product_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

-- Only admin and managers can update product templates
CREATE POLICY "Admin and managers can update product templates"
  ON public.product_templates FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

-- Only admin and managers can delete product templates
CREATE POLICY "Admin and managers can delete product templates"
  ON public.product_templates FOR DELETE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

-- Step 10: RLS Policies for product_inventory
-- Users can view inventory from their store or all if admin
CREATE POLICY "Users can view inventory from their store"
  ON public.product_inventory FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

-- Admin and managers can insert inventory for their store
CREATE POLICY "Admin and managers can insert inventory"
  ON public.product_inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Admin and managers can update inventory for their store
CREATE POLICY "Admin and managers can update inventory"
  ON public.product_inventory FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Admin and managers can delete inventory for their store
CREATE POLICY "Admin and managers can delete inventory"
  ON public.product_inventory FOR DELETE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Step 11: Create triggers for updated_at
CREATE TRIGGER update_product_templates_updated_at
  BEFORE UPDATE ON public.product_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_inventory_updated_at
  BEFORE UPDATE ON public.product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Create function to auto-create stock movement on inventory quantity change
CREATE OR REPLACE FUNCTION create_stock_movement_on_inventory_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create movement if quantity changed
  IF OLD.quantity != NEW.quantity THEN
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      inventory_id,
      user_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      notes
    ) VALUES (
      NEW.product_id,
      NEW.store_id,
      NEW.id,
      auth.uid(),
      'adjustment',
      NEW.quantity - OLD.quantity,
      OLD.quantity,
      NEW.quantity,
      'Automatic adjustment from inventory update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Create trigger to auto-create stock movement on inventory quantity change
CREATE TRIGGER auto_create_stock_movement_on_inventory
  AFTER UPDATE OF quantity ON public.product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_stock_movement_on_inventory_update();

-- Step 14: Add helpful comments
COMMENT ON TABLE public.product_templates IS 'Product templates with common information shared across all stores';
COMMENT ON TABLE public.product_inventory IS 'Store-specific inventory levels for each product template';
COMMENT ON COLUMN public.product_templates.sku IS 'Stock Keeping Unit - unique product identifier across all stores';
COMMENT ON COLUMN public.product_inventory.quantity IS 'Current quantity in stock for this product at this specific store';
COMMENT ON COLUMN public.stock_movements.inventory_id IS 'Reference to the specific inventory record (product + store combination)';

-- Step 15: Update stock_movements RLS policy to work with new structure
-- Drop old policies that reference products table
DROP POLICY IF EXISTS "Users can view stock movements from their store" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated users can insert stock movements" ON public.stock_movements;

-- Create new policies
CREATE POLICY "Users can view stock movements from their store"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

CREATE POLICY "Authenticated users can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
    AND user_id = (SELECT auth.uid())
  );
