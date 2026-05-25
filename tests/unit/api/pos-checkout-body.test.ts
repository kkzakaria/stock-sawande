import { describe, it, expect } from 'vitest'
import { checkoutBodySchema } from '@/app/api/pos/checkout/schema'

describe('checkoutBodySchema', () => {
  const validBody = {
    storeId: '550e8400-e29b-41d4-a716-446655440000',
    cashierId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    customerId: null,
    sessionId: null,
    items: [{
      productId: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      inventoryId: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      quantity: 2,
      price: 10,
      discount: 0,
    }],
    subtotal: 20,
    tax: 0,
    discount: 0,
    total: 20,
    paymentMethod: 'cash' as const,
    notes: '',
    idempotencyKey: 'abc-123',
  }

  it('accepts a valid body', () => {
    const result = checkoutBodySchema.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = checkoutBodySchema.safeParse({ ...validBody, items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing idempotencyKey', () => {
    const { idempotencyKey: _ik, ...rest } = validBody
    const result = checkoutBodySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = checkoutBodySchema.safeParse({
      ...validBody,
      items: [{ ...validBody.items[0], quantity: -1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid payment method', () => {
    const result = checkoutBodySchema.safeParse({ ...validBody, paymentMethod: 'bitcoin' })
    expect(result.success).toBe(false)
  })

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
})
