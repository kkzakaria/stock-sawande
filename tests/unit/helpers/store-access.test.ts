import { describe, it, expect } from 'vitest'
import { hasStoreAccess } from '@/lib/helpers/store-access'

describe('hasStoreAccess', () => {
  it('admin has access to any store', () => {
    expect(hasStoreAccess('admin', [], '11111111-1111-4111-8111-111111111111')).toBe(true)
  })

  it('manager with store in list has access', () => {
    const stores = ['aaaa-bbbb', 'cccc-dddd']
    expect(hasStoreAccess('manager', stores, 'cccc-dddd')).toBe(true)
  })

  it('manager without store in list is denied', () => {
    const stores = ['aaaa-bbbb']
    expect(hasStoreAccess('manager', stores, 'cccc-dddd')).toBe(false)
  })

  it('cashier with store in list has access', () => {
    expect(hasStoreAccess('cashier', ['store-a'], 'store-a')).toBe(true)
  })

  it('null storeId returns false', () => {
    expect(hasStoreAccess('admin', [], null)).toBe(false)
  })
})
