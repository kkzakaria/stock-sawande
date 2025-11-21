-- Fix stock movements triggers to use 'reference' column instead of 'reference_type' and 'reference_id'

-- Drop existing triggers
DROP TRIGGER IF EXISTS deduct_inventory_on_sale_trigger ON public.sales;
DROP TRIGGER IF EXISTS restore_inventory_on_refund_trigger ON public.sales;

-- Recreate deduct_inventory_on_sale function with correct column names
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
      reference,
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
      'sale:' || NEW.id::TEXT,   -- reference format: "sale:uuid"
      'Inventory deducted for sale ' || NEW.sale_number
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate restore_inventory_on_refund function with correct column names
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
      reference,
      notes
    )
    SELECT
      si.product_id,
      NEW.store_id,
      si.inventory_id,
      NEW.cashier_id,
      'refund',
      si.quantity,
      pi.quantity - si.quantity, -- previous (before restoration)
      pi.quantity,                -- new (after restoration)
      'refund:' || NEW.id::TEXT,  -- reference format: "refund:uuid"
      'Inventory restored for refund of sale ' || NEW.sale_number
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
CREATE TRIGGER deduct_inventory_on_sale_trigger
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_sale();

CREATE TRIGGER restore_inventory_on_refund_trigger
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION restore_inventory_on_refund();
