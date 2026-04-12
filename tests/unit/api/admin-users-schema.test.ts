import { describe, it, expect } from 'vitest'
import { createUserSchema } from '@/app/api/admin/users/schema'

describe('createUserSchema', () => {
  const base = {
    email: 'user@example.com',
    password: 'StrongPass123',
    full_name: 'John Doe',
    role: 'cashier' as const,
  }

  it('accepts a strong password', () => {
    expect(createUserSchema.safeParse(base).success).toBe(true)
  })

  it('rejects password shorter than 10 characters', () => {
    expect(createUserSchema.safeParse({ ...base, password: 'Short1A' }).success).toBe(false)
  })

  it('rejects password without uppercase', () => {
    expect(createUserSchema.safeParse({ ...base, password: 'lowercase123' }).success).toBe(false)
  })

  it('rejects password without digit', () => {
    expect(createUserSchema.safeParse({ ...base, password: 'NoDigitsHereABC' }).success).toBe(false)
  })

  it('rejects invalid email', () => {
    expect(createUserSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false)
  })
})
