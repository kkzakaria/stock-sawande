-- Phase 2: Core Features Schema
-- Categories, Products, and Stock Movements tables

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(name)
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  cost DECIMAL(10, 2) CHECK (cost >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock_level INTEGER DEFAULT 10 CHECK (min_stock_level >= 0),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Stock movement type enum
CREATE TYPE stock_movement_type AS ENUM (
  'purchase',
  'sale',
  'adjustment',
  'transfer',
  'return',
  'damage',
  'loss'
);

-- Stock movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity != 0),
  previous_quantity INTEGER NOT NULL CHECK (previous_quantity >= 0),
  new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
  notes TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_products_store_id ON public.products(store_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_store_id ON public.stock_movements(store_id);
CREATE INDEX idx_stock_movements_user_id ON public.stock_movements(user_id);
CREATE INDEX idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at DESC);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Categories policies: All authenticated users can read, only admin/manager can modify
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and managers can insert categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and managers can update categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and managers can delete categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Products policies: Users can only see products from their assigned store or all stores if admin
CREATE POLICY "Users can view products from their store"
  ON public.products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR products.store_id = profiles.store_id
      )
    )
  );

CREATE POLICY "Admin and managers can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
      AND (
        profiles.role = 'admin'
        OR products.store_id = profiles.store_id
      )
    )
  );

CREATE POLICY "Admin and managers can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
      AND (
        profiles.role = 'admin'
        OR products.store_id = profiles.store_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
      AND (
        profiles.role = 'admin'
        OR products.store_id = profiles.store_id
      )
    )
  );

CREATE POLICY "Admin and managers can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
      AND (
        profiles.role = 'admin'
        OR products.store_id = profiles.store_id
      )
    )
  );

-- Stock movements policies: Users can view movements from their store
CREATE POLICY "Users can view stock movements from their store"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR stock_movements.store_id = profiles.store_id
      )
    )
  );

CREATE POLICY "Authenticated users can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR stock_movements.store_id = profiles.store_id
      )
    )
    AND stock_movements.user_id = auth.uid()
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create stock movement when product quantity changes
CREATE OR REPLACE FUNCTION create_stock_movement_on_product_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create movement if quantity changed
  IF OLD.quantity != NEW.quantity THEN
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      user_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      notes
    ) VALUES (
      NEW.id,
      NEW.store_id,
      auth.uid(),
      'adjustment',
      NEW.quantity - OLD.quantity,
      OLD.quantity,
      NEW.quantity,
      'Automatic adjustment from product update'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create stock movement on product quantity change
CREATE TRIGGER auto_create_stock_movement
  AFTER UPDATE OF quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION create_stock_movement_on_product_update();

-- Seed some default categories
INSERT INTO public.categories (name, description) VALUES
  ('Electronics', 'Electronic devices and accessories'),
  ('Clothing', 'Apparel and fashion items'),
  ('Food & Beverages', 'Food and drink products'),
  ('Home & Garden', 'Home and garden supplies'),
  ('Sports & Outdoors', 'Sports equipment and outdoor gear'),
  ('Books & Media', 'Books, magazines, and media content'),
  ('Toys & Games', 'Toys and gaming products'),
  ('Health & Beauty', 'Health and beauty products'),
  ('Automotive', 'Automotive parts and accessories'),
  ('Office Supplies', 'Office and stationery supplies')
ON CONFLICT (name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE public.categories IS 'Product categories for organization';
COMMENT ON TABLE public.products IS 'Product catalog with inventory levels';
COMMENT ON TABLE public.stock_movements IS 'Audit trail of all stock quantity changes';
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN public.products.min_stock_level IS 'Minimum quantity before low stock alert';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Change amount (positive for increase, negative for decrease)';
