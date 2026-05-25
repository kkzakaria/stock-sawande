-- Migration: sale_payments_insert_policy
-- Adds INSERT policy on sale_payments so the offline sync route (which runs
-- with the authenticated user's JWT and is therefore subject to RLS) can
-- insert payment split rows when syncing hybrid transactions.
--
-- The policy mirrors the pattern used for sale_items: the inserting user must
-- be the cashier of the parent sale and must have store access.

GRANT INSERT ON public.sale_payments TO authenticated;

CREATE POLICY "Cashiers can insert sale payments"
  ON public.sale_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_payments.sale_id
      AND s.cashier_id = (SELECT auth.uid())
      AND public.user_has_store_access(s.store_id)
  ));
