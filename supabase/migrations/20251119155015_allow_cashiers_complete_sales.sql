-- Allow cashiers to complete their own sales
-- This policy enables the workflow: INSERT with status='pending', then UPDATE to status='completed'
-- which ensures sale_items exist before the inventory deduction trigger fires

CREATE POLICY "Cashiers can complete their own sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  -- Can only update sales they created
  cashier_id = auth.uid()
  AND
  -- Can only update sales from their own store
  store_id = get_current_user_store_id()
  AND
  -- Current status must be pending (prevent modifying completed sales)
  status = 'pending'
)
WITH CHECK (
  -- New status must be completed (only allow pending -> completed transition)
  status = 'completed'
  AND
  -- Ensure they don't change the cashier_id or store_id
  cashier_id = auth.uid()
  AND
  store_id = get_current_user_store_id()
);
