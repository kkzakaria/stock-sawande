-- Migration: Phase 3 - Sales (POS) System Schema
-- This migration creates tables and logic for point-of-sale transactions

-- Step 1: Create customers table (optional for tracking customer purchases)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  total_purchases DECIMAL(12, 2) DEFAULT 0 CHECK (total_purchases >= 0),
  total_spent DECIMAL(12, 2) DEFAULT 0 CHECK (total_spent >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: Create sales table (transactions)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  sale_number TEXT NOT NULL UNIQUE,
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  discount DECIMAL(12, 2) DEFAULT 0 CHECK (discount >= 0),
  total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile', 'other')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  notes TEXT,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 3: Create sale_items table (line items)
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.product_templates(id),
  inventory_id UUID NOT NULL REFERENCES public.product_inventory(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount DECIMAL(12, 2) DEFAULT 0 CHECK (discount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_phone ON public.customers(phone);

CREATE INDEX idx_sales_store_id ON public.sales(store_id);
CREATE INDEX idx_sales_cashier_id ON public.sales(cashier_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX idx_sales_sale_number ON public.sales(sale_number);
CREATE INDEX idx_sales_status ON public.sales(status);
CREATE INDEX idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX idx_sales_store_created ON public.sales(store_id, created_at DESC);

CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX idx_sale_items_inventory_id ON public.sale_items(inventory_id);

-- Step 5: Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for customers
-- Anyone authenticated can view customers
CREATE POLICY "Anyone can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);

-- Cashiers and above can create customers
CREATE POLICY "Cashiers can create customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role, 'cashier'::user_role])
  );

-- Managers and above can update customers
CREATE POLICY "Managers can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role])
  );

-- Step 7: RLS Policies for sales
-- Users can view sales from their store or all if admin
CREATE POLICY "Users can view sales from their store"
  ON public.sales FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

-- Cashiers and above can create sales for their store
CREATE POLICY "Cashiers can create sales"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role, 'cashier'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
    AND cashier_id = (SELECT auth.uid())
  );

-- Managers and above can update sales (for refunds/corrections)
CREATE POLICY "Managers can update sales"
  ON public.sales FOR UPDATE
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

-- Step 8: RLS Policies for sale_items
-- Users can view sale items if they can view the parent sale
CREATE POLICY "Users can view sale items from their store"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR s.store_id = (SELECT public.get_current_user_store_id())
      )
    )
  );

-- Cashiers can insert sale items for sales they can create
CREATE POLICY "Cashiers can insert sale items"
  ON public.sale_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
      AND s.cashier_id = (SELECT auth.uid())
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR s.store_id = (SELECT public.get_current_user_store_id())
      )
    )
  );

-- Step 9: Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Create function to generate unique sale numbers
CREATE OR REPLACE FUNCTION generate_sale_number(store_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  store_code TEXT;
  date_part TEXT;
  sequence_num INTEGER;
  sale_num TEXT;
BEGIN
  -- Get store code (first 3 chars of store name, uppercase)
  SELECT UPPER(SUBSTRING(name FROM 1 FOR 3))
  INTO store_code
  FROM public.stores
  WHERE id = store_uuid;

  -- If no store code, use 'STR'
  IF store_code IS NULL OR store_code = '' THEN
    store_code := 'STR';
  END IF;

  -- Get date part (YYYYMMDD)
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');

  -- Get sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM '(\d+)$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.sales
  WHERE store_id = store_uuid
    AND sale_number LIKE store_code || '-' || date_part || '-%';

  -- Format: STR-20251119-0001
  sale_num := store_code || '-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN sale_num;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create function to auto-generate sale number on insert
CREATE OR REPLACE FUNCTION auto_generate_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if sale_number is not provided or empty
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := generate_sale_number(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create trigger to auto-generate sale number
CREATE TRIGGER auto_generate_sale_number_trigger
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_sale_number();

-- Step 13: Create function to deduct inventory on sale completion
CREATE OR REPLACE FUNCTION deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Only deduct inventory when sale is completed (not pending)
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Deduct inventory for each sale item
    UPDATE public.product_inventory pi
    SET quantity = pi.quantity - si.quantity
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND si.inventory_id = pi.id;

    -- Create stock movements for audit trail
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      inventory_id,
      user_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      reference_type,
      reference_id,
      notes
    )
    SELECT
      si.product_id,
      NEW.store_id,
      si.inventory_id,
      NEW.cashier_id,
      'sale',
      -si.quantity,
      pi.quantity + si.quantity, -- previous (before deduction)
      pi.quantity,                -- new (after deduction)
      'sale',
      NEW.id,
      'Inventory deducted for sale ' || NEW.sale_number
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 14: Create trigger to deduct inventory on sale completion
CREATE TRIGGER deduct_inventory_on_sale_trigger
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_sale();

-- Step 15: Create function to restore inventory on refund
CREATE OR REPLACE FUNCTION restore_inventory_on_refund()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore inventory when sale is refunded (not other statuses)
  IF NEW.status = 'refunded' AND (OLD.status != 'refunded') THEN
    -- Restore inventory for each sale item
    UPDATE public.product_inventory pi
    SET quantity = pi.quantity + si.quantity
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND si.inventory_id = pi.id;

    -- Create stock movements for audit trail
    INSERT INTO public.stock_movements (
      product_id,
      store_id,
      inventory_id,
      user_id,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      reference_type,
      reference_id,
      notes
    )
    SELECT
      si.product_id,
      NEW.store_id,
      si.inventory_id,
      auth.uid(),
      'return',
      si.quantity,
      pi.quantity - si.quantity, -- previous (before restoration)
      pi.quantity,                -- new (after restoration)
      'sale_refund',
      NEW.id,
      'Inventory restored for refunded sale ' || NEW.sale_number ||
      CASE WHEN NEW.refund_reason IS NOT NULL THEN ' - ' || NEW.refund_reason ELSE '' END
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;

    -- Update refunded_at timestamp
    NEW.refunded_at := timezone('utc'::text, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 16: Create trigger to restore inventory on refund
CREATE TRIGGER restore_inventory_on_refund_trigger
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status != 'refunded')
  EXECUTE FUNCTION restore_inventory_on_refund();

-- Step 17: Create function to update customer totals on sale
CREATE OR REPLACE FUNCTION update_customer_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer totals when sale is completed
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
    UPDATE public.customers
    SET
      total_purchases = total_purchases + 1,
      total_spent = total_spent + NEW.total
    WHERE id = NEW.customer_id;
  END IF;

  -- Adjust customer totals when sale is refunded
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'refunded' AND OLD.status = 'completed' THEN
    UPDATE public.customers
    SET
      total_purchases = GREATEST(total_purchases - 1, 0),
      total_spent = GREATEST(total_spent - NEW.total, 0)
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 18: Create trigger to update customer totals
CREATE TRIGGER update_customer_totals_trigger
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  WHEN (NEW.customer_id IS NOT NULL)
  EXECUTE FUNCTION update_customer_totals();

-- Step 19: Add helpful comments
COMMENT ON TABLE public.customers IS 'Customer information for tracking purchases and loyalty';
COMMENT ON TABLE public.sales IS 'Sales transactions (POS receipts)';
COMMENT ON TABLE public.sale_items IS 'Line items for each sale transaction';

COMMENT ON COLUMN public.sales.sale_number IS 'Unique sale number format: STR-20251119-0001';
COMMENT ON COLUMN public.sales.subtotal IS 'Total before tax and discount';
COMMENT ON COLUMN public.sales.tax IS 'Total tax amount';
COMMENT ON COLUMN public.sales.discount IS 'Total discount amount';
COMMENT ON COLUMN public.sales.total IS 'Final total (subtotal + tax - discount)';
COMMENT ON COLUMN public.sales.payment_method IS 'Payment method: cash, card, mobile, other';
COMMENT ON COLUMN public.sales.status IS 'Sale status: pending, completed, refunded, cancelled';

COMMENT ON COLUMN public.sale_items.inventory_id IS 'Reference to specific store inventory (product + store)';
COMMENT ON COLUMN public.sale_items.subtotal IS 'Line item total (unit_price * quantity - discount)';

COMMENT ON FUNCTION generate_sale_number(UUID) IS 'Generate unique sale number in format STR-YYYYMMDD-0001';
COMMENT ON FUNCTION deduct_inventory_on_sale() IS 'Automatically deduct inventory when sale is completed';
COMMENT ON FUNCTION restore_inventory_on_refund() IS 'Automatically restore inventory when sale is refunded';
COMMENT ON FUNCTION update_customer_totals() IS 'Update customer purchase totals on sale completion/refund';
