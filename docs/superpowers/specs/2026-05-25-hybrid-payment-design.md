# Hybrid Payment — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Overview

Add support for split payments across two payment methods in a single POS transaction (e.g., 10 000 XOF cash + 5 000 XOF mobile money). The cashier selects the payment mode via two tabs: "Paiement unique" (existing behavior) and "Paiement hybride" (new).

## Requirements

- Max 2 payment methods per transaction.
- Cashier enters the amount for method 1; method 2 amount is auto-calculated as `total - amount1`.
- Works both online and offline (with deferred sync).
- Cash session totals distributed by real amounts per method.
- Backward compatible: existing single-method flow unchanged.

---

## 1. Database Schema

### 1.1 — `sales.payment_method` — add 'hybrid'

```sql
ALTER TABLE public.sales DROP CONSTRAINT sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'mobile', 'other', 'hybrid'));
```

### 1.2 — New table: `sale_payments`

```sql
CREATE TABLE public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile', 'other')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX idx_sale_payments_sale_id ON public.sale_payments(sale_id);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- SELECT: user must have access to the parent sale's store
CREATE POLICY "sale_payments_select" ON public.sale_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_payments.sale_id
        AND public.user_has_store_access(s.store_id)
    )
  );
-- INSERT: only via process_checkout RPC (SECURITY DEFINER), no direct INSERT policy
```

### 1.3 — Updated `process_checkout` RPC

New parameter: `p_payment_splits jsonb DEFAULT NULL`

Expected format: `[{"method": "cash", "amount": 10000}, {"method": "mobile", "amount": 5000}]`

**Logic:**
- If `p_payment_splits` is NOT NULL and has 2 entries:
  - Insert sale with `payment_method = 'hybrid'`
  - Insert 2 rows into `sale_payments`
  - Update `cash_sessions` totals by distributing amounts per method:
    ```sql
    total_cash_sales   += split.amount WHERE split.method = 'cash'
    total_card_sales   += split.amount WHERE split.method = 'card'
    total_mobile_sales += split.amount WHERE split.method = 'mobile'
    total_other_sales  += split.amount WHERE split.method = 'other'
    ```
- If `p_payment_splits` IS NULL → single method, existing behavior (no `sale_payments` rows).

**Validation in RPC:**
- Sum of split amounts must equal `p_total` (exact match required for financial integrity).
- Both methods must be distinct.

---

## 2. Types

### `lib/offline/db-schema.ts`

```typescript
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other' | 'hybrid'

export interface PaymentSplit {
  method: 'cash' | 'card' | 'mobile' | 'other'
  amount: number
}

// PendingTransaction gets:
paymentSplits?: PaymentSplit[]
```

### `types/database.types.ts`

Regenerated after migration — `sale_payments` table will appear automatically.

---

## 3. API Layer

### `app/api/pos/checkout/schema.ts`

```typescript
export const paymentSplitSchema = z.object({
  method: z.enum(['cash', 'card', 'mobile', 'other']),
  amount: z.number().positive(),
})

// checkoutBodySchema additions:
paymentMethod: z.enum(['cash', 'card', 'mobile', 'other', 'hybrid']),
paymentSplits: z.array(paymentSplitSchema).min(2).max(2).optional(),
// superRefine: if paymentMethod === 'hybrid', paymentSplits required,
//              sum of amounts must equal total (±0.01 tolerance),
//              methods must be distinct
```

### `app/api/pos/checkout/route.ts`

Pass `p_payment_splits` to the RPC when `body.paymentMethod === 'hybrid'`:
```typescript
p_payment_splits: body.paymentSplits ? JSON.stringify(body.paymentSplits) : undefined,
```

### `app/api/pos/sync/route.ts`

The sync route has its own sale-creation logic (it does NOT call `process_checkout` RPC; it inserts directly into `sales`, `sale_items`, inventory, and `cash_sessions`). It must be updated to:

1. Add `paymentSplits?: PaymentSplit[]` to `SyncTransactionRequest` interface.
2. When `tx.paymentMethod === 'hybrid'`, insert the sale with `payment_method: 'hybrid'`, then insert rows into `sale_payments` for each split.
3. For `cash_sessions` update: when hybrid, distribute amounts by split instead of the full `adjustedTotal`:
   ```typescript
   if (tx.paymentMethod === 'hybrid' && tx.paymentSplits) {
     for (const split of tx.paymentSplits) {
       const key = split.method === 'cash' ? 'total_cash_sales'
                 : split.method === 'card' ? 'total_card_sales'
                 : split.method === 'mobile' ? 'total_mobile_sales'
                 : 'total_other_sales'
       updates[key] = (currentSession[key] || 0) + split.amount
     }
   }
   ```

---

## 4. Offline Layer

### `lib/offline/db-schema.ts`
- `PaymentMethod` union extended with `'hybrid'`
- `PaymentSplit` interface added
- `PendingTransaction.paymentSplits?: PaymentSplit[]` field added

### `lib/hooks/use-offline-checkout.ts`
- `OfflineCheckoutData` gets `paymentSplits?: PaymentSplit[]`
- `processOfflineCheckout` stores splits in the `PendingTransaction`

### `lib/offline/sync-service.ts`
- `SyncTransactionRequest` gets `paymentSplits?: PaymentSplit[]`
- Sync payload includes splits when present

---

## 5. UI: `pos-checkout-modal.tsx`

Replace the `RadioGroup` with a `Tabs` component (shadcn/ui).

### Tab structure

```
┌──────────────────────────────────────────┐
│  [Paiement unique] | [Paiement hybride]  │
├──────────────────────────────────────────┤
│  Tab "Paiement unique":                  │
│    ○ Espèces   ○ Carte   ○ Mobile       │
│                                          │
│  Tab "Paiement hybride":                 │
│    Mode 1   [Select ▼]   [Amount input] │
│    Mode 2   [Select ▼]   [Readonly]     │  ← total - amount1
│    ✓ Total : 15 000 XOF                 │
└──────────────────────────────────────────┘
```

### State additions

```typescript
type PaymentTab = 'single' | 'hybrid'
const [paymentTab, setPaymentTab] = useState<PaymentTab>('single')
const [splitMethod1, setSplitMethod1] = useState<SinglePaymentMethod>('cash')
const [splitMethod2, setSplitMethod2] = useState<SinglePaymentMethod>('mobile')
const [splitAmount1, setSplitAmount1] = useState<string>('')
// splitAmount2 = total - parseFloat(splitAmount1) — derived, not state
```

### Validation

- `splitAmount1` must be a valid number > 0 and < total
- `splitMethod1 !== splitMethod2` (selectors mutually exclude each other's choice)
- Disable "Confirmer" button when amounts don't balance

### Checkout payload construction

```typescript
// Single tab
{ paymentMethod, paymentSplits: undefined }

// Hybrid tab
{
  paymentMethod: 'hybrid',
  paymentSplits: [
    { method: splitMethod1, amount: parseFloat(splitAmount1) },
    { method: splitMethod2, amount: total - parseFloat(splitAmount1) },
  ]
}
```

---

## 6. Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_hybrid_payment.sql` | New migration |
| `types/database.types.ts` | Regenerate after migration |
| `lib/offline/db-schema.ts` | Add `PaymentSplit`, extend `PaymentMethod`, add field to `PendingTransaction` |
| `lib/hooks/use-offline-checkout.ts` | Accept and store `paymentSplits` |
| `lib/offline/sync-service.ts` | Pass splits in sync payload |
| `app/api/pos/checkout/schema.ts` | Add `paymentSplitSchema`, extend `checkoutBodySchema` |
| `app/api/pos/checkout/route.ts` | Pass `p_payment_splits` to RPC |
| `app/api/pos/sync/route.ts` | Add `paymentSplits` to request type; insert `sale_payments` rows; distribute `cash_sessions` by split amounts |
| `components/pos/pos-checkout-modal.tsx` | Replace RadioGroup with Tabs, add hybrid UI |
| `messages/fr.json` + `messages/en.json` | Add translation keys for hybrid payment |

---

## 7. Out of Scope

- Receipt printing: "Hybride" displayed as payment method label (no per-split breakdown on receipt for now).
- More than 2 payment methods per transaction.
- Analytics views: `payment_method_summary` will show `'hybrid'` as a category; per-split breakdown available via `sale_payments` join.
