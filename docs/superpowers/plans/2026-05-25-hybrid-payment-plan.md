# Hybrid Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a POS sale to be paid with two payment methods simultaneously (e.g., 10 000 XOF cash + 5 000 XOF mobile money), with split amounts tracked in a dedicated `sale_payments` table.

**Architecture:** A new `sale_payments` table stores one row per method per hybrid sale. The `sales.payment_method` column gains a `'hybrid'` value. The `process_checkout` RPC and the offline sync route each receive a `paymentSplits` array and distribute `cash_sessions` totals by real split amounts. The checkout modal UI uses shadcn `Tabs` to switch between single and hybrid payment modes.

**Tech Stack:** PostgreSQL (pgTAP for DB tests), Zod (API validation), Zustand + IndexedDB (offline), Next.js App Router, shadcn/ui Tabs, Vitest (unit tests), next-intl (i18n).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260525000000_hybrid_payment.sql` | Create | DB schema: constraint, table, RLS, updated RPC |
| `supabase/tests/database/hybrid_payment.sql` | Create | pgTAP tests for updated RPC |
| `lib/offline/db-schema.ts` | Modify | Add `PaymentSplit` type + `paymentSplits` field on `PendingTransaction` |
| `app/api/pos/checkout/schema.ts` | Modify | Add `paymentSplitSchema`, `'hybrid'` to enum, superRefine validation |
| `tests/unit/api/pos-checkout-body.test.ts` | Modify | Add hybrid validation test cases |
| `app/api/pos/checkout/route.ts` | Modify | Pass `p_payment_splits` to RPC |
| `lib/hooks/use-offline-checkout.ts` | Modify | Store `paymentSplits` in offline transaction |
| `lib/offline/sync-service.ts` | Modify | Include `paymentSplits` in sync payload |
| `app/api/pos/sync/route.ts` | Modify | Handle hybrid in sale creation, `sale_payments` insert, `cash_sessions` distribution |
| `messages/fr.json` | Modify | Add hybrid payment i18n keys |
| `messages/en.json` | Modify | Add hybrid payment i18n keys |
| `components/pos/pos-checkout-modal.tsx` | Modify | Replace RadioGroup with Tabs; add hybrid UI |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260525000000_hybrid_payment.sql`
- Create: `supabase/tests/database/hybrid_payment.sql`

- [ ] **Step 1.1: Write the migration file**

Create `supabase/migrations/20260525000000_hybrid_payment.sql` with this exact content:

```sql
-- Migration: hybrid_payment
-- Adds sale_payments table and updates process_checkout RPC to support hybrid payments.

-- 1. Extend payment_method check constraint on sales
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'mobile', 'other', 'hybrid'));

-- 2. Create sale_payments table
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile', 'other')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON public.sale_payments(sale_id);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_payments_select" ON public.sale_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_payments.sale_id
        AND public.user_has_store_access(s.store_id)
    )
  );

GRANT SELECT ON public.sale_payments TO authenticated;

-- 3. Updated process_checkout RPC with hybrid payment support
CREATE OR REPLACE FUNCTION public.process_checkout(
  p_store_id uuid,
  p_cashier_id uuid,
  p_customer_id uuid DEFAULT NULL::uuid,
  p_cash_session_id uuid DEFAULT NULL::uuid,
  p_payment_method text DEFAULT 'cash'::text,
  p_payment_splits jsonb DEFAULT NULL::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_subtotal numeric DEFAULT 0,
  p_tax numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_notes text DEFAULT ''::text,
  p_idempotency_key text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_caller_role public.user_role;
  v_sale_id uuid;
  v_sale_number text;
  v_existing_sale_id uuid;
  v_item jsonb;
  v_split jsonb;
  v_inv_quantity integer;
  v_inv_product_id uuid;
  v_product_price numeric;
  v_product_min_price numeric;
  v_product_max_price numeric;
  v_epsilon numeric := 0.005;
  v_computed_subtotal numeric := 0;
  v_effective_method text;
  v_splits_sum numeric := 0;
BEGIN
  -- === Auth ===
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF v_caller_id <> p_cashier_id THEN
    RAISE EXCEPTION 'Cashier id mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = v_caller_id AND deleted_at IS NULL;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin'::public.user_role, 'manager'::public.user_role, 'cashier'::public.user_role) THEN
    RAISE EXCEPTION 'User not authorized to checkout' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role <> 'admin'::public.user_role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_stores WHERE user_id = v_caller_id AND store_id = p_store_id
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_caller_id AND store_id = p_store_id
      ) THEN
        RAISE EXCEPTION 'User not assigned to this store' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- === Idempotency ===
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT sale_id INTO v_existing_sale_id
    FROM public.checkout_idempotency
    WHERE key = p_idempotency_key
      AND cashier_id = v_caller_id;

    IF v_existing_sale_id IS NOT NULL THEN
      SELECT sale_number INTO v_sale_number
      FROM public.sales WHERE id = v_existing_sale_id;
      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_existing_sale_id,
        'sale_number', v_sale_number,
        'idempotent', true
      );
    END IF;
  END IF;

  -- === Validate payment splits if provided ===
  IF p_payment_splits IS NOT NULL THEN
    IF jsonb_array_length(p_payment_splits) <> 2 THEN
      RAISE EXCEPTION 'Hybrid payment requires exactly 2 payment splits' USING ERRCODE = '23514';
    END IF;

    IF (p_payment_splits->0->>'method') = (p_payment_splits->1->>'method') THEN
      RAISE EXCEPTION 'Hybrid payment methods must be distinct' USING ERRCODE = '23514';
    END IF;

    FOR v_split IN SELECT * FROM jsonb_array_elements(p_payment_splits)
    LOOP
      IF v_split->>'method' NOT IN ('cash', 'card', 'mobile', 'other') THEN
        RAISE EXCEPTION 'Invalid payment method in split: %', v_split->>'method' USING ERRCODE = '23514';
      END IF;
      IF (v_split->>'amount')::numeric <= 0 THEN
        RAISE EXCEPTION 'Split amount must be positive' USING ERRCODE = '23514';
      END IF;
      v_splits_sum := v_splits_sum + (v_split->>'amount')::numeric;
    END LOOP;

    IF abs(v_splits_sum - p_total) > v_epsilon THEN
      RAISE EXCEPTION 'Payment splits sum (%) does not match total (%)', v_splits_sum, p_total
        USING ERRCODE = '23514';
    END IF;

    v_effective_method := 'hybrid';
  ELSE
    v_effective_method := p_payment_method;
  END IF;

  -- === Validate items ===
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT pi.quantity, pi.product_id
    INTO v_inv_quantity, v_inv_product_id
    FROM public.product_inventory pi
    WHERE pi.id = (v_item->>'inventoryId')::uuid
      AND pi.store_id = p_store_id;

    IF v_inv_quantity IS NULL THEN
      RAISE EXCEPTION 'Inventory item % not found in store', v_item->>'inventoryId'
        USING ERRCODE = '23503';
    END IF;

    IF v_inv_quantity < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Insufficient stock for inventory %: available=%, requested=%',
        v_item->>'inventoryId', v_inv_quantity, (v_item->>'quantity')::int
        USING ERRCODE = '23514';
    END IF;

    SELECT price, min_price, max_price
    INTO v_product_price, v_product_min_price, v_product_max_price
    FROM public.product_templates
    WHERE id = v_inv_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product template % not found for inventory %',
        v_inv_product_id, v_item->>'inventoryId'
        USING ERRCODE = '23503';
    END IF;

    IF v_product_min_price IS NULL AND v_product_max_price IS NULL THEN
      IF abs((v_item->>'price')::numeric - v_product_price) > v_epsilon THEN
        RAISE EXCEPTION 'Price out of range for product %: must be %',
          v_inv_product_id, v_product_price
          USING ERRCODE = '23514';
      END IF;
    ELSE
      IF v_product_min_price IS NOT NULL
         AND (v_item->>'price')::numeric < v_product_min_price - v_epsilon THEN
        RAISE EXCEPTION 'Price below minimum for product %: min=%',
          v_inv_product_id, v_product_min_price
          USING ERRCODE = '23514';
      END IF;
      IF v_product_max_price IS NOT NULL
         AND (v_item->>'price')::numeric > v_product_max_price + v_epsilon THEN
        RAISE EXCEPTION 'Price above maximum for product %: max=%',
          v_inv_product_id, v_product_max_price
          USING ERRCODE = '23514';
      END IF;
    END IF;

    v_computed_subtotal := v_computed_subtotal + (
      (v_item->>'price')::numeric * (v_item->>'quantity')::int
      - COALESCE((v_item->>'discount')::numeric, 0)
    );
  END LOOP;

  IF abs(v_computed_subtotal - p_subtotal) > v_epsilon THEN
    RAISE EXCEPTION 'Subtotal mismatch: computed=%, submitted=%', v_computed_subtotal, p_subtotal
      USING ERRCODE = '23514';
  END IF;

  -- === Create sale (pending) ===
  INSERT INTO public.sales (
    store_id, cashier_id, customer_id, cash_session_id,
    subtotal, tax, discount, total, payment_method, status, notes
  )
  VALUES (
    p_store_id, p_cashier_id, p_customer_id, p_cash_session_id,
    p_subtotal, p_tax, p_discount, p_total, v_effective_method, 'pending', p_notes
  )
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

  -- === Insert sale_payments for hybrid ===
  IF p_payment_splits IS NOT NULL THEN
    INSERT INTO public.sale_payments (sale_id, payment_method, amount)
    SELECT
      v_sale_id,
      (s->>'method')::text,
      (s->>'amount')::numeric
    FROM jsonb_array_elements(p_payment_splits) s;
  END IF;

  -- === Insert sale_items ===
  INSERT INTO public.sale_items (sale_id, product_id, inventory_id, quantity, unit_price, discount, subtotal)
  SELECT
    v_sale_id,
    (elem->>'productId')::uuid,
    (elem->>'inventoryId')::uuid,
    (elem->>'quantity')::int,
    (elem->>'price')::numeric,
    COALESCE((elem->>'discount')::numeric, 0),
    (elem->>'price')::numeric * (elem->>'quantity')::int - COALESCE((elem->>'discount')::numeric, 0)
  FROM jsonb_array_elements(p_items) AS elem;

  -- === Complete sale → triggers inventory deduction ===
  UPDATE public.sales SET status = 'completed' WHERE id = v_sale_id;

  -- === Update cash_session counters ===
  IF p_cash_session_id IS NOT NULL THEN
    IF p_payment_splits IS NOT NULL THEN
      UPDATE public.cash_sessions
      SET
        transaction_count  = COALESCE(transaction_count, 0) + 1,
        total_cash_sales   = COALESCE(total_cash_sales, 0)   + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' = 'cash'),
        total_card_sales   = COALESCE(total_card_sales, 0)   + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' = 'card'),
        total_mobile_sales = COALESCE(total_mobile_sales, 0) + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' = 'mobile'),
        total_other_sales  = COALESCE(total_other_sales, 0)  + (SELECT COALESCE(SUM((s->>'amount')::numeric), 0) FROM jsonb_array_elements(p_payment_splits) s WHERE s->>'method' NOT IN ('cash', 'card', 'mobile'))
      WHERE id = p_cash_session_id
        AND store_id = p_store_id
        AND status = 'open';
    ELSE
      UPDATE public.cash_sessions
      SET
        transaction_count  = COALESCE(transaction_count, 0)  + 1,
        total_cash_sales   = COALESCE(total_cash_sales, 0)   + CASE WHEN v_effective_method = 'cash'   THEN p_total ELSE 0 END,
        total_card_sales   = COALESCE(total_card_sales, 0)   + CASE WHEN v_effective_method = 'card'   THEN p_total ELSE 0 END,
        total_mobile_sales = COALESCE(total_mobile_sales, 0) + CASE WHEN v_effective_method = 'mobile' THEN p_total ELSE 0 END,
        total_other_sales  = COALESCE(total_other_sales, 0)  + CASE WHEN v_effective_method NOT IN ('cash','card','mobile') THEN p_total ELSE 0 END
      WHERE id = p_cash_session_id
        AND store_id = p_store_id
        AND status = 'open';
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cash session % not found, not open, or not in store %',
        p_cash_session_id, p_store_id
        USING ERRCODE = '23503';
    END IF;
  END IF;

  -- === Store idempotency key ===
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    INSERT INTO public.checkout_idempotency (key, sale_id, cashier_id)
    VALUES (p_idempotency_key, v_sale_id, v_caller_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'idempotent', false
  );
END $function$;
```

- [ ] **Step 1.2: Write the pgTAP test file**

Create `supabase/tests/database/hybrid_payment.sql`:

```sql
BEGIN;
SELECT plan(6);

CREATE TEMP TABLE _hybrid_ids (
  store_id     uuid,
  cashier_id   uuid,
  product_id   uuid,
  inventory_id uuid,
  session_id   uuid
) ON COMMIT DROP;

DO $$
DECLARE
  v_store_id     uuid;
  v_cashier_id   uuid;
  v_product_id   uuid;
  v_inventory_id uuid;
  v_session_id   uuid;
BEGIN
  INSERT INTO public.stores (name, address)
  VALUES ('HybridTestStore', '1 Hybrid Ave')
  RETURNING id INTO v_store_id;

  v_cashier_id := tests.create_test_user('hybrid_cashier', 'cashier');

  INSERT INTO public.user_stores (user_id, store_id, is_default)
  VALUES (v_cashier_id, v_store_id, true);

  UPDATE public.profiles SET store_id = v_store_id WHERE id = v_cashier_id;

  INSERT INTO public.product_templates (sku, name, price)
  VALUES ('HYBRID-SKU-001', 'Hybrid Test Product', 100.00)
  RETURNING id INTO v_product_id;

  INSERT INTO public.product_inventory (product_id, store_id, quantity)
  VALUES (v_product_id, v_store_id, 10)
  RETURNING id INTO v_inventory_id;

  INSERT INTO public.cash_sessions (store_id, cashier_id, opening_balance, status)
  VALUES (v_store_id, v_cashier_id, 0, 'open')
  RETURNING id INTO v_session_id;

  INSERT INTO _hybrid_ids VALUES (v_store_id, v_cashier_id, v_product_id, v_inventory_id, v_session_id);
END;
$$;

-- Test 1: hybrid checkout succeeds and creates sale with payment_method = 'hybrid'
SELECT tests.authenticate_as('hybrid_cashier');

SELECT ok(
  (
    SELECT (result->>'success')::boolean
    FROM public.process_checkout(
      p_store_id       := (SELECT store_id FROM _hybrid_ids),
      p_cashier_id     := (SELECT cashier_id FROM _hybrid_ids),
      p_cash_session_id := (SELECT session_id FROM _hybrid_ids),
      p_payment_method := 'cash',
      p_payment_splits := '[{"method":"cash","amount":60},{"method":"mobile","amount":40}]'::jsonb,
      p_items          := jsonb_build_array(jsonb_build_object(
        'productId',   (SELECT product_id FROM _hybrid_ids),
        'inventoryId', (SELECT inventory_id FROM _hybrid_ids),
        'quantity',    1,
        'price',       100.00,
        'discount',    0
      )),
      p_subtotal       := 100.00,
      p_tax            := 0,
      p_discount       := 0,
      p_total          := 100.00,
      p_idempotency_key := 'hybrid-test-1'
    ) result
  ),
  'hybrid checkout succeeds'
);

-- Test 2: sale has payment_method = 'hybrid'
SELECT is(
  (SELECT payment_method FROM public.sales WHERE sale_number IN (
    SELECT sale_number FROM public.sales
    WHERE cashier_id = (SELECT cashier_id FROM _hybrid_ids)
    ORDER BY created_at DESC LIMIT 1
  )),
  'hybrid',
  'sale.payment_method is hybrid'
);

-- Test 3: sale_payments has 2 rows
SELECT is(
  (SELECT COUNT(*)::int FROM public.sale_payments sp
   JOIN public.sales s ON s.id = sp.sale_id
   WHERE s.cashier_id = (SELECT cashier_id FROM _hybrid_ids)
   ORDER BY s.created_at DESC),
  2,
  'sale_payments has 2 rows for hybrid sale'
);

-- Test 4: cash_sessions totals distributed correctly
SELECT is(
  (SELECT total_cash_sales FROM public.cash_sessions WHERE id = (SELECT session_id FROM _hybrid_ids)),
  60.00::numeric(12,2),
  'cash_session.total_cash_sales = 60'
);

SELECT is(
  (SELECT total_mobile_sales FROM public.cash_sessions WHERE id = (SELECT session_id FROM _hybrid_ids)),
  40.00::numeric(12,2),
  'cash_session.total_mobile_sales = 40'
);

-- Test 5: mismatched split sum is rejected
SELECT throws_ok(
  $t$
    SELECT public.process_checkout(
      p_store_id       := (SELECT store_id FROM _hybrid_ids),
      p_cashier_id     := (SELECT cashier_id FROM _hybrid_ids),
      p_payment_splits := '[{"method":"cash","amount":30},{"method":"mobile","amount":40}]'::jsonb,
      p_items          := jsonb_build_array(jsonb_build_object(
        'productId',   (SELECT product_id FROM _hybrid_ids),
        'inventoryId', (SELECT inventory_id FROM _hybrid_ids),
        'quantity',    1,
        'price',       100.00,
        'discount',    0
      )),
      p_subtotal       := 100.00,
      p_tax            := 0,
      p_discount       := 0,
      p_total          := 100.00,
      p_idempotency_key := 'hybrid-test-bad-sum'
    )
  $t$,
  '23514',
  'rejects splits that do not sum to total'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 1.3: Apply and test the migration locally**

```bash
npx supabase db reset
```

Expected: migration runs without errors, all previous tests still pass.

- [ ] **Step 1.4: Run pgTAP tests**

```bash
supabase test db
```

Expected: all 6 tests pass in `hybrid_payment.sql`, no regressions in other test files.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/20260525000000_hybrid_payment.sql supabase/tests/database/hybrid_payment.sql
git commit -m "feat(db): add sale_payments table and hybrid payment support in process_checkout"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `lib/offline/db-schema.ts:31,70`

- [ ] **Step 2.1: Update the type definitions**

In `lib/offline/db-schema.ts`, make these two changes:

**Change 1** — extend `PaymentMethod` (line 31):
```typescript
// Before:
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other'

// After:
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other' | 'hybrid'

export interface PaymentSplit {
  method: 'cash' | 'card' | 'mobile' | 'other'
  amount: number
}
```

**Change 2** — add `paymentSplits` to `PendingTransaction` (after line 70, after the `paymentMethod` field):
```typescript
  paymentMethod: PaymentMethod
  paymentSplits?: PaymentSplit[]  // present when paymentMethod === 'hybrid'
  notes: string
```

- [ ] **Step 2.2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2.3: Commit**

```bash
git add lib/offline/db-schema.ts
git commit -m "feat(types): add PaymentSplit type and paymentSplits field for hybrid payment"
```

---

## Task 3: Checkout API Schema Validation

**Files:**
- Modify: `app/api/pos/checkout/schema.ts`
- Modify: `tests/unit/api/pos-checkout-body.test.ts`

- [ ] **Step 3.1: Write failing tests**

Add these cases to `tests/unit/api/pos-checkout-body.test.ts`, after the existing `it('rejects invalid payment method', ...)` test:

```typescript
  const validSplit = [
    { method: 'cash' as const, amount: 12 },
    { method: 'mobile' as const, amount: 8 },
  ]
  const hybridBody = { ...validBody, total: 20, paymentMethod: 'hybrid' as const, paymentSplits: validSplit }

  it('accepts a valid hybrid payment', () => {
    const result = checkoutBodySchema.safeParse(hybridBody)
    expect(result.success).toBe(true)
  })

  it('rejects hybrid without paymentSplits', () => {
    const result = checkoutBodySchema.safeParse({ ...hybridBody, paymentSplits: undefined })
    expect(result.success).toBe(false)
  })

  it('rejects hybrid with duplicate methods', () => {
    const result = checkoutBodySchema.safeParse({
      ...hybridBody,
      paymentSplits: [
        { method: 'cash', amount: 12 },
        { method: 'cash', amount: 8 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects hybrid when split amounts do not sum to total', () => {
    const result = checkoutBodySchema.safeParse({
      ...hybridBody,
      paymentSplits: [
        { method: 'cash', amount: 5 },
        { method: 'mobile', amount: 8 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects split with non-positive amount', () => {
    const result = checkoutBodySchema.safeParse({
      ...hybridBody,
      paymentSplits: [
        { method: 'cash', amount: 0 },
        { method: 'mobile', amount: 20 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects paymentMethod=hybrid without exactly 2 splits', () => {
    const result = checkoutBodySchema.safeParse({
      ...hybridBody,
      paymentSplits: [{ method: 'cash', amount: 20 }],
    })
    expect(result.success).toBe(false)
  })
```

- [ ] **Step 3.2: Run tests — expect failures**

```bash
pnpm test:unit tests/unit/api/pos-checkout-body.test.ts
```

Expected: the 6 new test cases all FAIL (schema doesn't support hybrid yet).

- [ ] **Step 3.3: Update the schema**

Replace the entire content of `app/api/pos/checkout/schema.ts` with:

```typescript
import { z } from 'zod'

const uuid = z.string().uuid()

export const checkoutItemSchema = z.object({
  productId: uuid,
  inventoryId: uuid,
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
})

export const paymentSplitSchema = z.object({
  method: z.enum(['cash', 'card', 'mobile', 'other']),
  amount: z.number().positive(),
})

export const checkoutBodySchema = z.object({
  storeId: uuid,
  cashierId: uuid,
  customerId: uuid.nullable(),
  sessionId: uuid.nullable().optional(),
  items: z.array(checkoutItemSchema).min(1, 'Cart is empty'),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  paymentMethod: z.enum(['cash', 'card', 'mobile', 'other', 'hybrid']),
  paymentSplits: z.array(paymentSplitSchema).min(2).max(2).optional(),
  notes: z.string().default(''),
  idempotencyKey: z.string().min(1, 'idempotencyKey required'),
}).superRefine((data, ctx) => {
  if (data.paymentMethod !== 'hybrid') return

  if (!data.paymentSplits || data.paymentSplits.length !== 2) {
    ctx.addIssue({ code: 'custom', path: ['paymentSplits'], message: 'Hybrid payment requires exactly 2 splits' })
    return
  }

  const [a, b] = data.paymentSplits
  if (a.method === b.method) {
    ctx.addIssue({ code: 'custom', path: ['paymentSplits'], message: 'Hybrid payment methods must be distinct' })
  }

  const sum = a.amount + b.amount
  if (Math.abs(sum - data.total) > 0.01) {
    ctx.addIssue({ code: 'custom', path: ['paymentSplits'], message: `Split amounts (${sum}) must equal total (${data.total})` })
  }
})

export type CheckoutBody = z.infer<typeof checkoutBodySchema>
export type PaymentSplit = z.infer<typeof paymentSplitSchema>
```

- [ ] **Step 3.4: Run tests — expect all passing**

```bash
pnpm test:unit tests/unit/api/pos-checkout-body.test.ts
```

Expected: all tests PASS (existing 4 + new 6 = 10 total).

- [ ] **Step 3.5: Commit**

```bash
git add app/api/pos/checkout/schema.ts tests/unit/api/pos-checkout-body.test.ts
git commit -m "feat(api): add hybrid payment validation to checkout schema"
```

---

## Task 4: Checkout API Route

**Files:**
- Modify: `app/api/pos/checkout/route.ts`

- [ ] **Step 4.1: Pass payment splits to the RPC**

In `app/api/pos/checkout/route.ts`, update the `supabase.rpc('process_checkout', {...})` call.

Replace:
```typescript
    const { data, error } = await supabase.rpc('process_checkout', {
      p_store_id: body.storeId,
      p_cashier_id: body.cashierId,
      p_customer_id: body.customerId ?? undefined,
      p_cash_session_id: body.sessionId ?? undefined,
      p_payment_method: body.paymentMethod,
      p_items: body.items,
```

With:
```typescript
    const { data, error } = await supabase.rpc('process_checkout', {
      p_store_id: body.storeId,
      p_cashier_id: body.cashierId,
      p_customer_id: body.customerId ?? undefined,
      p_cash_session_id: body.sessionId ?? undefined,
      p_payment_method: body.paymentMethod === 'hybrid' ? 'cash' : body.paymentMethod,
      p_payment_splits: body.paymentSplits ? body.paymentSplits : undefined,
      p_items: body.items,
```

Note: `p_payment_method` is kept for backward compatibility when `p_payment_splits` is absent; the RPC ignores it when splits are provided (it uses `v_effective_method = 'hybrid'`).

- [ ] **Step 4.2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4.3: Commit**

```bash
git add app/api/pos/checkout/route.ts
git commit -m "feat(api): pass payment_splits to process_checkout RPC for hybrid payments"
```

---

## Task 5: Offline Checkout Hook

**Files:**
- Modify: `lib/hooks/use-offline-checkout.ts`

- [ ] **Step 5.1: Update OfflineCheckoutData and processOfflineCheckout**

In `lib/hooks/use-offline-checkout.ts`:

**Change 1** — update the import at the top:
```typescript
import type {
  PendingTransaction,
  PendingTransactionItem,
  PaymentMethod,
  PaymentSplit,
} from '@/lib/offline/db-schema'
```

**Change 2** — add `paymentSplits` to `OfflineCheckoutData` (after `paymentMethod` field):
```typescript
export interface OfflineCheckoutData {
  storeId: string
  cashierId: string
  sessionId: string | null
  customerId: string | null
  items: OfflineCheckoutItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: PaymentMethod
  paymentSplits?: PaymentSplit[]
  notes: string
  storeInfo: {
    name: string
    address: string | null
    phone: string | null
  }
  cashierName: string
}
```

**Change 3** — include `paymentSplits` in the `PendingTransaction` object created inside `processOfflineCheckout` (after `paymentMethod: data.paymentMethod,`):
```typescript
          paymentMethod: data.paymentMethod,
          paymentSplits: data.paymentSplits,
```

- [ ] **Step 5.2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5.3: Commit**

```bash
git add lib/hooks/use-offline-checkout.ts
git commit -m "feat(offline): store paymentSplits in pending transaction for hybrid payments"
```

---

## Task 6: Sync Service

**Files:**
- Modify: `lib/offline/sync-service.ts`

- [ ] **Step 6.1: Include paymentSplits in sync payload**

In `lib/offline/sync-service.ts`:

**Change 1** — add `paymentSplits` to the import or the `SyncTransactionRequest` type (line ~44):

Find the `SyncTransactionRequest` interface:
```typescript
interface SyncTransactionRequest {
  // ... existing fields ...
  paymentMethod: string
  notes: string
  createdAt: string
}
```

Add the field:
```typescript
interface SyncTransactionRequest {
  // ... existing fields ...
  paymentMethod: string
  paymentSplits?: Array<{ method: string; amount: number }>
  notes: string
  createdAt: string
}
```

**Change 2** — in the `requests` array mapping (around line 147), after `paymentMethod: tx.paymentMethod,`:
```typescript
        paymentMethod: tx.paymentMethod,
        paymentSplits: tx.paymentSplits,
```

- [ ] **Step 6.2: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6.3: Commit**

```bash
git add lib/offline/sync-service.ts
git commit -m "feat(sync): include paymentSplits in offline sync payload"
```

---

## Task 7: Sync Route

**Files:**
- Modify: `app/api/pos/sync/route.ts`

- [ ] **Step 7.1: Update SyncTransactionRequest interface**

In `app/api/pos/sync/route.ts`, update the `SyncTransactionRequest` interface (around line 16):

Add `paymentSplits` after `paymentMethod`:
```typescript
interface SyncTransactionRequest {
  localId: string
  localReceiptNumber: string
  storeId: string
  cashierId: string
  sessionId: string | null
  customerId: string | null
  items: Array<{
    productId: string
    inventoryId: string
    quantity: number
    price: number
    discount: number
  }>
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: string
  paymentSplits?: Array<{ method: string; amount: number }>
  notes: string
  createdAt: string
}
```

- [ ] **Step 7.2: Handle hybrid in sale INSERT**

Find the sale INSERT block (around line 254). The `payment_method` field currently uses `tx.paymentMethod` directly. No change needed here — the sync route sets `payment_method: tx.paymentMethod` and when `tx.paymentMethod === 'hybrid'` the constraint now allows it.

- [ ] **Step 7.3: Insert sale_payments rows for hybrid transactions**

After the sale INSERT block (after `if (saleError || !sale) { ... }`), add a `sale_payments` insert block. Find the comment `// Create sale items` (around line 281) and insert before it:

```typescript
  // Insert sale_payments for hybrid transactions
  if (tx.paymentMethod === 'hybrid' && tx.paymentSplits && tx.paymentSplits.length > 0) {
    const splitRows = tx.paymentSplits.map((split) => ({
      sale_id: sale.id,
      payment_method: split.method,
      amount: split.amount,
    }))
    const { error: splitsError } = await supabase.from('sale_payments').insert(splitRows)
    if (splitsError) {
      await supabase.from('sales').delete().eq('id', sale.id)
      return {
        localId: tx.localId,
        status: 'failed',
        error: `Failed to create sale_payments: ${splitsError.message}`,
      }
    }
  }
```

- [ ] **Step 7.4: Update cash_sessions distribution for hybrid**

Find the cash_sessions update block (around line 341). Replace the entire `if (tx.sessionId) { ... }` block with:

```typescript
  // Update cash session if provided
  if (tx.sessionId) {
    const { data: currentSession } = await supabase
      .from('cash_sessions')
      .select('total_cash_sales, total_card_sales, total_mobile_sales, total_other_sales, transaction_count')
      .eq('id', tx.sessionId)
      .single()

    if (currentSession) {
      const updates: Record<string, number> = {
        transaction_count: (currentSession.transaction_count || 0) + 1,
      }

      if (tx.paymentMethod === 'hybrid' && tx.paymentSplits) {
        for (const split of tx.paymentSplits) {
          if (split.method === 'cash') {
            updates.total_cash_sales = (currentSession.total_cash_sales || 0) + split.amount
          } else if (split.method === 'card') {
            updates.total_card_sales = (currentSession.total_card_sales || 0) + split.amount
          } else if (split.method === 'mobile') {
            updates.total_mobile_sales = (currentSession.total_mobile_sales || 0) + split.amount
          } else {
            updates.total_other_sales = (currentSession.total_other_sales || 0) + split.amount
          }
        }
      } else {
        if (tx.paymentMethod === 'cash') {
          updates.total_cash_sales = (currentSession.total_cash_sales || 0) + adjustedTotal
        } else if (tx.paymentMethod === 'card') {
          updates.total_card_sales = (currentSession.total_card_sales || 0) + adjustedTotal
        } else if (tx.paymentMethod === 'mobile') {
          updates.total_mobile_sales = (currentSession.total_mobile_sales || 0) + adjustedTotal
        } else {
          updates.total_other_sales = (currentSession.total_other_sales || 0) + adjustedTotal
        }
      }

      await supabase
        .from('cash_sessions')
        .update(updates)
        .eq('id', tx.sessionId)
    }
  }
```

- [ ] **Step 7.5: Verify types compile**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7.6: Commit**

```bash
git add app/api/pos/sync/route.ts
git commit -m "feat(sync): handle hybrid payment in offline sync route (sale_payments + cash_sessions)"
```

---

## Task 8: Translations

**Files:**
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

- [ ] **Step 8.1: Add French translations**

In `messages/fr.json`, inside the `"POS" > "checkout"` object (after `"mobile": "Paiement mobile",`), add:

```json
      "singlePayment": "Paiement unique",
      "hybridPayment": "Paiement hybride",
      "hybridMethod1": "Mode 1",
      "hybridMethod2": "Mode 2",
      "hybridAmount1": "Montant",
      "hybridAmount2": "Reste (auto)",
      "hybridAmountError": "Le montant doit être supérieur à 0 et inférieur au total",
      "hybrid": "Hybride",
```

- [ ] **Step 8.2: Add English translations**

In `messages/en.json`, inside the `"POS" > "checkout"` object (after `"mobile": "Mobile Payment",`), add:

```json
      "singlePayment": "Single Payment",
      "hybridPayment": "Split Payment",
      "hybridMethod1": "Method 1",
      "hybridMethod2": "Method 2",
      "hybridAmount1": "Amount",
      "hybridAmount2": "Remainder (auto)",
      "hybridAmountError": "Amount must be greater than 0 and less than the total",
      "hybrid": "Hybrid",
```

- [ ] **Step 8.3: Commit**

```bash
git add messages/fr.json messages/en.json
git commit -m "feat(i18n): add hybrid payment translation keys"
```

---

## Task 9: UI — Checkout Modal

**Files:**
- Modify: `components/pos/pos-checkout-modal.tsx`

- [ ] **Step 9.1: Update imports**

At the top of `components/pos/pos-checkout-modal.tsx`, add the `Tabs` imports and `Select` imports:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
```

Keep the existing `RadioGroup` and `RadioGroupItem` import — they are still used in the single-payment tab.

- [ ] **Step 9.2: Update type and state declarations**

Replace:
```typescript
type PaymentMethod = 'cash' | 'card' | 'mobile'
```

With:
```typescript
type SinglePaymentMethod = 'cash' | 'card' | 'mobile'
type PaymentTab = 'single' | 'hybrid'
```

After the existing state declarations (`const [paymentMethod, setPaymentMethod] = ...`), add:

```typescript
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('single')
  const [paymentMethod, setPaymentMethod] = useState<SinglePaymentMethod>('cash')
  const [splitMethod1, setSplitMethod1] = useState<SinglePaymentMethod>('cash')
  const [splitMethod2, setSplitMethod2] = useState<SinglePaymentMethod>('mobile')
  const [splitAmount1, setSplitAmount1] = useState<string>('')
```

**Important:** The new state block above already includes `paymentMethod` and `setPaymentMethod`. Delete the original `const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')` line from the file to avoid a duplicate declaration.

Note: `splitAmount2` is derived — not stored in state:
```typescript
  const splitAmount1Num = parseFloat(splitAmount1) || 0
  const splitAmount2Num = total - splitAmount1Num
  const isHybridValid = paymentTab === 'hybrid'
    ? splitAmount1Num > 0 && splitAmount1Num < total && splitMethod1 !== splitMethod2
    : true
```

Place this derived computation block just before the `useEffect` that handles offline warnings.

- [ ] **Step 9.3: Update handleOnlineCheckout**

Replace the body construction inside `handleOnlineCheckout`:

```typescript
  const handleOnlineCheckout = async () => {
    const isHybrid = paymentTab === 'hybrid'
    const response = await fetch('/api/pos/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        cashierId,
        sessionId,
        customerId,
        items: items.map((item) => ({
          productId: item.productId,
          inventoryId: item.inventoryId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
        })),
        subtotal: subtotalTTC,
        tax,
        discount,
        total,
        paymentMethod: isHybrid ? 'hybrid' : paymentMethod,
        paymentSplits: isHybrid
          ? [
              { method: splitMethod1, amount: splitAmount1Num },
              { method: splitMethod2, amount: splitAmount2Num },
            ]
          : undefined,
        notes,
        idempotencyKey: crypto.randomUUID(),
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Checkout failed')
    }

    const { saleId, saleNumber } = await response.json()
    return { saleId, saleNumber }
  }
```

- [ ] **Step 9.4: Update handleOfflineCheckout**

Replace the `processOfflineCheckout` call inside `handleOfflineCheckout`:

```typescript
  const handleOfflineCheckout = async () => {
    const isHybrid = paymentTab === 'hybrid'
    const offlineItems = items.map((item) => ({
      productId: item.productId,
      inventoryId: item.inventoryId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      discount: item.discount,
    }))

    const result = await processOfflineCheckout({
      storeId,
      cashierId,
      sessionId: sessionId ?? null,
      customerId,
      items: offlineItems,
      subtotal: subtotalTTC,
      tax,
      discount,
      total,
      paymentMethod: isHybrid ? 'hybrid' : paymentMethod,
      paymentSplits: isHybrid
        ? [
            { method: splitMethod1, amount: splitAmount1Num },
            { method: splitMethod2, amount: splitAmount2Num },
          ]
        : undefined,
      notes,
      storeInfo,
      cashierName,
    })

    if (!result.success) {
      throw new Error(result.error || 'Offline checkout failed')
    }

    return {
      saleId: result.localId!,
      saleNumber: result.localReceiptNumber!,
    }
  }
```

- [ ] **Step 9.5: Replace the payment method section in the JSX**

Find the `{/* Payment Method */}` section and replace it entirely with:

```tsx
          {/* Payment Method */}
          <div className="space-y-3">
            <Label>{t('paymentMethod')}</Label>
            <Tabs value={paymentTab} onValueChange={(v) => setPaymentTab(v as PaymentTab)}>
              <TabsList className="w-full">
                <TabsTrigger value="single" className="flex-1">{t('singlePayment')}</TabsTrigger>
                <TabsTrigger value="hybrid" className="flex-1">{t('hybridPayment')}</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="mt-3">
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as SinglePaymentMethod)}
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Banknote className="h-5 w-5 text-green-600" />
                      <span>{t('cash')}</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <span>{t('card')}</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                    <RadioGroupItem value="mobile" id="mobile" />
                    <Label htmlFor="mobile" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Smartphone className="h-5 w-5 text-purple-600" />
                      <span>{t('mobile')}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </TabsContent>

              <TabsContent value="hybrid" className="mt-3 space-y-3">
                {/* Split 1 */}
                <div className="flex items-center gap-3 border rounded-lg p-3">
                  <span className="text-sm text-gray-500 w-16 shrink-0">{t('hybridMethod1')}</span>
                  <Select
                    value={splitMethod1}
                    onValueChange={(v) => setSplitMethod1(v as SinglePaymentMethod)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {splitMethod2 !== 'cash' && <SelectItem value="cash">{t('cash')}</SelectItem>}
                      {splitMethod2 !== 'card' && <SelectItem value="card">{t('card')}</SelectItem>}
                      {splitMethod2 !== 'mobile' && <SelectItem value="mobile">{t('mobile')}</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    max={total - 1}
                    step={1}
                    value={splitAmount1}
                    onChange={(e) => setSplitAmount1(e.target.value)}
                    placeholder="0"
                    className="flex-1"
                  />
                </div>

                {/* Split 2 (remainder) */}
                <div className="flex items-center gap-3 border rounded-lg p-3 bg-gray-50">
                  <span className="text-sm text-gray-500 w-16 shrink-0">{t('hybridMethod2')}</span>
                  <Select
                    value={splitMethod2}
                    onValueChange={(v) => setSplitMethod2(v as SinglePaymentMethod)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {splitMethod1 !== 'cash' && <SelectItem value="cash">{t('cash')}</SelectItem>}
                      {splitMethod1 !== 'card' && <SelectItem value="card">{t('card')}</SelectItem>}
                      {splitMethod1 !== 'mobile' && <SelectItem value="mobile">{t('mobile')}</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="flex-1 px-3 py-2 text-sm font-medium text-gray-700">
                    {splitAmount2Num > 0 ? formatCurrency(splitAmount2Num) : '—'}
                    <span className="ml-2 text-xs text-gray-400">{t('hybridAmount2')}</span>
                  </div>
                </div>

                {/* Validation feedback */}
                {splitAmount1 !== '' && !isHybridValid && (
                  <p className="text-sm text-red-600">{t('hybridAmountError')}</p>
                )}
                {isHybridValid && splitAmount1 !== '' && (
                  <p className="text-sm text-green-600">
                    {formatCurrency(splitAmount1Num)} + {formatCurrency(splitAmount2Num)} = {formatCurrency(total)}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
```

- [ ] **Step 9.6: Disable the confirm button when hybrid is invalid**

Find the confirm `<Button onClick={handleCheckout} disabled={isProcessing} ...>` and update:

```tsx
          <Button
            onClick={handleCheckout}
            disabled={isProcessing || !isHybridValid}
            className={!isOnline ? 'bg-orange-600 hover:bg-orange-700' : ''}
          >
```

- [ ] **Step 9.7: Type check and lint**

```bash
pnpm tsc --noEmit && npm run lint
```

Expected: zero errors, only pre-existing warnings (not introduced by this task).

- [ ] **Step 9.8: Commit**

```bash
git add components/pos/pos-checkout-modal.tsx
git commit -m "feat(ui): add hybrid payment tab to POS checkout modal"
```

---

## Task 10: Full Verification

- [ ] **Step 10.1: Full type check**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 10.2: Unit tests**

```bash
pnpm test:unit
```

Expected: all tests pass, including the 6 new hybrid schema tests.

- [ ] **Step 10.3: Production build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 10.4: Database tests (manual)**

```bash
supabase test db
```

Expected: all pgTAP tests pass including `hybrid_payment.sql`.

- [ ] **Step 10.5: Regenerate Supabase types**

```bash
npx supabase gen types typescript --project-id "your-project-ref" > types/database.types.ts
```

Expected: `types/database.types.ts` now includes the `sale_payments` table types.

- [ ] **Step 10.6: Commit type update if changed**

```bash
git add types/database.types.ts
git commit -m "chore(types): regenerate Supabase types after hybrid payment migration"
```
