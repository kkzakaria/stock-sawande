-- Migration: Fix stock_movements triggers to use correct column names
-- The triggers were using reference_type and reference_id, but the table has a single 'reference' column

-- Fix deduct_inventory_on_sale trigger
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_sale()
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
      'sale:' || NEW.id::text,    -- reference format: type:id
      'Inventory deducted for sale ' || NEW.sale_number
    FROM public.sale_items si
    JOIN public.product_inventory pi ON si.inventory_id = pi.id
    WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Fix restore_inventory_on_refund trigger
CREATE OR REPLACE FUNCTION public.restore_inventory_on_refund()
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
      auth.uid(),
      'return',
      si.quantity,
      pi.quantity - si.quantity, -- previous (before restoration)
      pi.quantity,                -- new (after restoration)
      'sale_refund:' || NEW.id::text,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
