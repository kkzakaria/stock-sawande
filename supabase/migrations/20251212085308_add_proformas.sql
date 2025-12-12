-- Migration: Add Proformas (Pro-forma Invoices)
-- Proformas are preliminary invoices/quotes that can be converted to sales

-- Step 1: Create proforma_status enum
CREATE TYPE public.proforma_status AS ENUM (
  'draft',      -- Not yet finalized
  'sent',       -- Sent to customer
  'accepted',   -- Customer accepted
  'rejected',   -- Customer rejected
  'converted',  -- Converted to sale
  'expired'     -- Validity period ended
);

-- Step 2: Create proformas table
CREATE TABLE IF NOT EXISTS public.proformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  proforma_number TEXT NOT NULL UNIQUE,
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
  tax DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  discount DECIMAL(12, 2) DEFAULT 0 CHECK (discount >= 0),
  total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
  status public.proforma_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  terms TEXT,                                              -- Payment terms, conditions
  valid_until DATE,                                        -- Validity/expiration date
  converted_sale_id UUID REFERENCES public.sales(id),      -- Link to sale if converted
  converted_at TIMESTAMP WITH TIME ZONE,                   -- When it was converted
  sent_at TIMESTAMP WITH TIME ZONE,                        -- When sent to customer
  accepted_at TIMESTAMP WITH TIME ZONE,                    -- When customer accepted
  rejected_at TIMESTAMP WITH TIME ZONE,                    -- When customer rejected
  rejection_reason TEXT,                                   -- Reason for rejection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 3: Create proforma_items table (line items)
CREATE TABLE IF NOT EXISTS public.proforma_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id UUID NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.product_templates(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount DECIMAL(12, 2) DEFAULT 0 CHECK (discount >= 0),
  notes TEXT,                                              -- Line item notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 4: Create indexes for performance
CREATE INDEX idx_proformas_store_id ON public.proformas(store_id);
CREATE INDEX idx_proformas_created_by ON public.proformas(created_by);
CREATE INDEX idx_proformas_customer_id ON public.proformas(customer_id);
CREATE INDEX idx_proformas_proforma_number ON public.proformas(proforma_number);
CREATE INDEX idx_proformas_status ON public.proformas(status);
CREATE INDEX idx_proformas_created_at ON public.proformas(created_at DESC);
CREATE INDEX idx_proformas_valid_until ON public.proformas(valid_until);
CREATE INDEX idx_proformas_store_created ON public.proformas(store_id, created_at DESC);
CREATE INDEX idx_proformas_converted_sale ON public.proformas(converted_sale_id);

CREATE INDEX idx_proforma_items_proforma_id ON public.proforma_items(proforma_id);
CREATE INDEX idx_proforma_items_product_id ON public.proforma_items(product_id);

-- Step 5: Enable Row Level Security
ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_items ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for proformas
-- Users can view proformas from their store or all if admin
CREATE POLICY "Users can view proformas from their store"
  ON public.proformas FOR SELECT
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR store_id = (SELECT public.get_current_user_store_id())
  );

-- Cashiers and above can create proformas for their store
CREATE POLICY "Staff can create proformas"
  ON public.proformas FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_current_user_role()) = ANY(ARRAY['admin'::user_role, 'manager'::user_role, 'cashier'::user_role])
    AND (
      (SELECT public.get_current_user_role()) = 'admin'
      OR store_id = (SELECT public.get_current_user_store_id())
    )
    AND created_by = (SELECT auth.uid())
  );

-- Staff can update their own proformas, managers can update all in their store
CREATE POLICY "Staff can update proformas"
  ON public.proformas FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      (SELECT public.get_current_user_role()) = 'manager'
      AND store_id = (SELECT public.get_current_user_store_id())
    )
    OR (
      created_by = (SELECT auth.uid())
      AND store_id = (SELECT public.get_current_user_store_id())
    )
  )
  WITH CHECK (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      (SELECT public.get_current_user_role()) = 'manager'
      AND store_id = (SELECT public.get_current_user_store_id())
    )
    OR (
      created_by = (SELECT auth.uid())
      AND store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Managers and above can delete proformas
CREATE POLICY "Managers can delete proformas"
  ON public.proformas FOR DELETE
  TO authenticated
  USING (
    (SELECT public.get_current_user_role()) = 'admin'
    OR (
      (SELECT public.get_current_user_role()) = 'manager'
      AND store_id = (SELECT public.get_current_user_store_id())
    )
  );

-- Step 7: RLS Policies for proforma_items
-- Users can view proforma items if they can view the parent proforma
CREATE POLICY "Users can view proforma items from their store"
  ON public.proforma_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.id = proforma_id
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR p.store_id = (SELECT public.get_current_user_store_id())
      )
    )
  );

-- Staff can insert proforma items for proformas they can create
CREATE POLICY "Staff can insert proforma items"
  ON public.proforma_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.id = proforma_id
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR (
          p.store_id = (SELECT public.get_current_user_store_id())
          AND (
            p.created_by = (SELECT auth.uid())
            OR (SELECT public.get_current_user_role()) = 'manager'
          )
        )
      )
    )
  );

-- Staff can update proforma items for their proformas
CREATE POLICY "Staff can update proforma items"
  ON public.proforma_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.id = proforma_id
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR (
          p.store_id = (SELECT public.get_current_user_store_id())
          AND (
            p.created_by = (SELECT auth.uid())
            OR (SELECT public.get_current_user_role()) = 'manager'
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.id = proforma_id
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR (
          p.store_id = (SELECT public.get_current_user_store_id())
          AND (
            p.created_by = (SELECT auth.uid())
            OR (SELECT public.get_current_user_role()) = 'manager'
          )
        )
      )
    )
  );

-- Staff can delete proforma items for their proformas
CREATE POLICY "Staff can delete proforma items"
  ON public.proforma_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.id = proforma_id
      AND (
        (SELECT public.get_current_user_role()) = 'admin'
        OR (
          p.store_id = (SELECT public.get_current_user_store_id())
          AND (
            p.created_by = (SELECT auth.uid())
            OR (SELECT public.get_current_user_role()) = 'manager'
          )
        )
      )
    )
  );

-- Step 8: Create triggers for updated_at
CREATE TRIGGER update_proformas_updated_at
  BEFORE UPDATE ON public.proformas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Create function to generate unique proforma numbers
CREATE OR REPLACE FUNCTION public.generate_proforma_number(store_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store_code TEXT;
  date_part TEXT;
  sequence_num INTEGER;
  proforma_num TEXT;
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
  SELECT COALESCE(MAX(CAST(SUBSTRING(proforma_number FROM '(\d+)$') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.proformas
  WHERE store_id = store_uuid
    AND proforma_number LIKE 'PRO-' || store_code || '-' || date_part || '-%';

  -- Format: PRO-STR-20251212-0001
  proforma_num := 'PRO-' || store_code || '-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');

  RETURN proforma_num;
END;
$$;

-- Step 10: Create function to auto-generate proforma number on insert
CREATE OR REPLACE FUNCTION public.auto_generate_proforma_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only generate if proforma_number is not provided or empty
  IF NEW.proforma_number IS NULL OR NEW.proforma_number = '' THEN
    NEW.proforma_number := public.generate_proforma_number(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Step 11: Create trigger to auto-generate proforma number
CREATE TRIGGER auto_generate_proforma_number_trigger
  BEFORE INSERT ON public.proformas
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_proforma_number();

-- Step 12: Create function to check and update expired proformas
CREATE OR REPLACE FUNCTION public.update_expired_proformas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.proformas
  SET status = 'expired'
  WHERE status IN ('draft', 'sent')
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Step 13: Add helpful comments
COMMENT ON TABLE public.proformas IS 'Pro-forma invoices (quotes) that can be converted to sales';
COMMENT ON TABLE public.proforma_items IS 'Line items for each pro-forma invoice';

COMMENT ON COLUMN public.proformas.proforma_number IS 'Unique proforma number format: PRO-STR-20251212-0001';
COMMENT ON COLUMN public.proformas.subtotal IS 'Total before tax and discount';
COMMENT ON COLUMN public.proformas.tax IS 'Total tax amount';
COMMENT ON COLUMN public.proformas.discount IS 'Total discount amount';
COMMENT ON COLUMN public.proformas.total IS 'Final total (subtotal + tax - discount)';
COMMENT ON COLUMN public.proformas.status IS 'Proforma status: draft, sent, accepted, rejected, converted, expired';
COMMENT ON COLUMN public.proformas.valid_until IS 'Date until which the proforma is valid';
COMMENT ON COLUMN public.proformas.terms IS 'Payment terms and conditions';
COMMENT ON COLUMN public.proformas.converted_sale_id IS 'Reference to sale if proforma was converted';

COMMENT ON COLUMN public.proforma_items.subtotal IS 'Line item total (unit_price * quantity - discount)';

COMMENT ON FUNCTION public.generate_proforma_number(UUID) IS 'Generate unique proforma number in format PRO-STR-YYYYMMDD-0001';
COMMENT ON FUNCTION public.update_expired_proformas() IS 'Mark proformas as expired when valid_until date has passed';
