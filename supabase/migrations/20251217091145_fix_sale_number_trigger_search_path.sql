-- Migration: Fix auto_generate_sale_number function search_path
-- Problem: The function has SET search_path TO '' which prevents finding generate_sale_number()
-- Solution: Use fully qualified function name (public.generate_sale_number)

CREATE OR REPLACE FUNCTION public.auto_generate_sale_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if sale_number is not provided or empty
  IF NEW.sale_number IS NULL OR NEW.sale_number = '' THEN
    NEW.sale_number := public.generate_sale_number(NEW.store_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Also fix generate_sale_number to use fully qualified table names
CREATE OR REPLACE FUNCTION public.generate_sale_number(store_uuid UUID)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';
