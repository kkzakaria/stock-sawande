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
