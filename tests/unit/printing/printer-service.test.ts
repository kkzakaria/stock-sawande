import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sampleReceiptData, config80mm } from './fixtures'
import { setPrinterConfig, clearPrinterConfig } from '@/lib/printing/config'

vi.mock('@/lib/printing/transports/usb', () => ({
  isWebUsbSupported: vi.fn(() => true),
  printUsb: vi.fn(),
  requestUsbDevice: vi.fn(),
}))

vi.mock('@/lib/printing/transports/network', () => ({
  printNetwork: vi.fn(),
}))

import { printUsb } from '@/lib/printing/transports/usb'
import { printNetwork } from '@/lib/printing/transports/network'
import { printReceipt } from '@/lib/printing/printer-service'

describe('printerService.printReceipt', () => {
  beforeEach(() => {
    // Match the storage strategy used by config.test.ts so reads/writes see the same store.
    const mockStorage: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v },
      removeItem: (k: string) => { delete mockStorage[k] },
      clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) },
      get length() { return Object.keys(mockStorage).length },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    })
    clearPrinterConfig()
    vi.mocked(printUsb).mockReset()
    vi.mocked(printNetwork).mockReset()
  })

  it('returns not-configured when no config is stored', async () => {
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({ ok: false, error: { kind: 'not-configured' } })
    expect(printUsb).not.toHaveBeenCalled()
  })

  it('returns not-configured when stored config has enabled=false', async () => {
    setPrinterConfig({ ...config80mm, enabled: false })
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({ ok: false, error: { kind: 'not-configured' } })
  })

  it('routes to the USB transport when transport is usb', async () => {
    setPrinterConfig(config80mm)
    vi.mocked(printUsb).mockResolvedValue({ ok: true })
    const result = await printReceipt(sampleReceiptData)
    expect(printUsb).toHaveBeenCalledOnce()
    expect(result).toEqual({ ok: true })
  })

  it('propagates the transport error', async () => {
    setPrinterConfig(config80mm)
    vi.mocked(printUsb).mockResolvedValue({
      ok: false,
      error: { kind: 'device-not-found' },
    })
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({ ok: false, error: { kind: 'device-not-found' } })
  })

  it('returns not-configured when transport is bluetooth (Phase 1 unsupported)', async () => {
    setPrinterConfig({
      ...config80mm,
      transport: 'bluetooth',
      bluetooth: {
        deviceId: 'x',
        serviceUuid: 'y',
        characteristicUuid: 'z',
      },
    })
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({ ok: false, error: { kind: 'not-configured' } })
  })

  it('returns transport-error when USB ids are missing from config', async () => {
    const broken = { ...config80mm }
    delete broken.usb
    setPrinterConfig(broken)
    const result = await printReceipt(sampleReceiptData)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('transport-error')
    expect(printUsb).not.toHaveBeenCalled()
  })

  it('routes to the network transport when transport is network', async () => {
    setPrinterConfig({
      ...config80mm,
      transport: 'network',
      network: { host: '192.168.1.50', port: 9100, timeoutMs: 5000 },
    })
    vi.mocked(printNetwork).mockResolvedValue({ ok: true })
    const result = await printReceipt(sampleReceiptData)
    expect(printNetwork).toHaveBeenCalledOnce()
    expect(result).toEqual({ ok: true })
  })

  it('propagates network transport error', async () => {
    setPrinterConfig({
      ...config80mm,
      transport: 'network',
      network: { host: '192.168.1.50', port: 9100, timeoutMs: 5000 },
    })
    vi.mocked(printNetwork).mockResolvedValue({
      ok: false,
      error: { kind: 'transport-error', message: 'Connection refused' },
    })
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({
      ok: false,
      error: { kind: 'transport-error', message: 'Connection refused' },
    })
  })

  it('returns transport-error when network transport is selected but network config is missing', async () => {
    const brokenConfig = { ...config80mm, transport: 'network' as const }
    delete (brokenConfig as Partial<typeof brokenConfig>).network
    setPrinterConfig(brokenConfig)
    const result = await printReceipt(sampleReceiptData)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('transport-error')
    expect(printNetwork).not.toHaveBeenCalled()
  })
})
