-- Drop the old process_checkout overload (without p_payment_splits).
-- CREATE OR REPLACE FUNCTION added a new overload instead of replacing the
-- existing one because the parameter list changed (p_payment_splits was added).
-- PostgREST cannot resolve between the two signatures (PGRST203), so we drop
-- the old one and keep only the new signature with p_payment_splits.
DROP FUNCTION IF EXISTS public.process_checkout(
  uuid,      -- p_store_id
  uuid,      -- p_cashier_id
  uuid,      -- p_customer_id
  uuid,      -- p_cash_session_id
  text,      -- p_payment_method
  jsonb,     -- p_items
  numeric,   -- p_subtotal
  numeric,   -- p_tax
  numeric,   -- p_discount
  numeric,   -- p_total
  text,      -- p_notes
  text       -- p_idempotency_key
);
