import { z } from 'zod'

const uuid = z.string().uuid()

export const checkoutItemSchema = z.object({
  productId: uuid,
  inventoryId: uuid,
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
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
  paymentMethod: z.enum(['cash', 'card', 'mobile', 'other']),
  notes: z.string().default(''),
  idempotencyKey: z.string().min(1, 'idempotencyKey required'),
})

export type CheckoutBody = z.infer<typeof checkoutBodySchema>
