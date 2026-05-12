import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getPrinterConfig,
  setPrinterConfig,
  clearPrinterConfig,
  PRINTER_CONFIG_KEY,
} from '@/lib/printing/config'
import { DEFAULT_PRINTER_CONFIG } from '@/lib/printing/types'
import { config80mm } from './fixtures'

// Mock localStorage since happy-dom's implementation is incomplete
const mockStorage: Record<string, string> = {}

const localStorageMock = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value
  },
  removeItem: (key: string) => {
    delete mockStorage[key]
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => {
      delete mockStorage[key]
    })
  },
  get length() {
    return Object.keys(mockStorage).length
  },
  key: (index: number) => Object.keys(mockStorage)[index] ?? null,
}

describe('printer config', () => {
  beforeEach(() => {
    // Use our mock localStorage for all tests
    vi.stubGlobal('localStorage', localStorageMock)
    Object.keys(mockStorage).forEach((key) => {
      delete mockStorage[key]
    })
  })

  it('returns null when nothing is stored', () => {
    expect(getPrinterConfig()).toBeNull()
  })

  it('persists and retrieves a config', () => {
    setPrinterConfig(config80mm)
    expect(getPrinterConfig()).toEqual(config80mm)
  })

  it('overwrites a previous config', () => {
    setPrinterConfig(config80mm)
    setPrinterConfig({ ...config80mm, width: 58 })
    expect(getPrinterConfig()?.width).toBe(58)
  })

  it('clearPrinterConfig removes the stored config', () => {
    setPrinterConfig(config80mm)
    clearPrinterConfig()
    expect(getPrinterConfig()).toBeNull()
  })

  it('returns null when stored JSON is malformed', () => {
    localStorage.setItem(PRINTER_CONFIG_KEY, '{not json')
    expect(getPrinterConfig()).toBeNull()
  })

  it('returns null when the stored value lacks required keys', () => {
    localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify({ foo: 'bar' }))
    expect(getPrinterConfig()).toBeNull()
  })

  it('exposes a sensible default config', () => {
    expect(DEFAULT_PRINTER_CONFIG.enabled).toBe(false)
    expect(DEFAULT_PRINTER_CONFIG.transport).toBe('usb')
    expect(DEFAULT_PRINTER_CONFIG.width).toBe(80)
  })
})
