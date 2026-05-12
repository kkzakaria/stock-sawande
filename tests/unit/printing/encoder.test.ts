import { describe, it, expect } from 'vitest'
import { encodeReceipt } from '@/lib/printing/encoder'
import { sampleReceiptData, config58mm, config80mm } from './fixtures'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}

describe('encodeReceipt', () => {
  it('returns a non-empty Uint8Array for 80mm receipt', () => {
    const bytes = encodeReceipt(sampleReceiptData, config80mm)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('starts with the ESC @ initialize sequence (0x1b 0x40)', () => {
    const bytes = encodeReceipt(sampleReceiptData, config80mm)
    expect(bytes[0]).toBe(0x1b)
    expect(bytes[1]).toBe(0x40)
  })

  it('ends with a cut command when autoCut is true', () => {
    const bytes = encodeReceipt(sampleReceiptData, config80mm)
    const last20 = Array.from(bytes.slice(-20))
    const hasCutSequence = last20.some(
      (b, i) => b === 0x1d && last20[i + 1] === 0x56,
    )
    expect(hasCutSequence).toBe(true)
  })

  it('omits the cut command when autoCut is false', () => {
    const bytes = encodeReceipt(sampleReceiptData, { ...config80mm, autoCut: false })
    const last20 = Array.from(bytes.slice(-20))
    const hasCutSequence = last20.some(
      (b, i) => b === 0x1d && last20[i + 1] === 0x56,
    )
    expect(hasCutSequence).toBe(false)
  })

  it('produces a different (longer) output for 80mm than 58mm', () => {
    const bytes80 = encodeReceipt(sampleReceiptData, config80mm)
    const bytes58 = encodeReceipt(sampleReceiptData, config58mm)
    expect(bytes80.length).not.toBe(bytes58.length)
  })

  it('matches snapshot for 80mm sample receipt (stable byte output)', () => {
    const bytes = encodeReceipt(sampleReceiptData, config80mm)
    expect(bytesToHex(bytes)).toMatchSnapshot()
  })

  it('matches snapshot for 58mm sample receipt', () => {
    const bytes = encodeReceipt(sampleReceiptData, config58mm)
    expect(bytesToHex(bytes)).toMatchSnapshot()
  })

  it('handles receipts with no cashier name', () => {
    const data = { ...sampleReceiptData, cashier: { full_name: null } }
    const bytes = encodeReceipt(data, config80mm)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('handles receipts with a global discount', () => {
    const data = { ...sampleReceiptData, discount: 1000 }
    const bytes = encodeReceipt(data, config80mm)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('handles receipts with notes', () => {
    const data = { ...sampleReceiptData, notes: 'Client à recontacter' }
    const bytes = encodeReceipt(data, config80mm)
    expect(bytes.length).toBeGreaterThan(0)
  })
})
