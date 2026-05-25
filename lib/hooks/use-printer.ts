'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import type { ReceiptData } from '@/components/pos/pos-receipt'
import { printReceipt } from '@/lib/printing/printer-service'
import {
  getPrinterConfig,
  setPrinterConfig,
  clearPrinterConfig,
  PRINTER_CONFIG_KEY,
} from '@/lib/printing/config'
import type { PrinterConfig, PrintResult, PrinterError } from '@/lib/printing/types'
import { requestUsbDevice } from '@/lib/printing/transports/usb'
import { savePrinterConfigToDB } from '@/lib/actions/business-settings'

type Status = 'idle' | 'printing' | 'error'

// Module-level cache makes getSnapshot return a stable reference until
// localStorage actually changes. Required by useSyncExternalStore.
let cachedRaw: string | null | undefined
let cachedValue: PrinterConfig | null = null

function readSnapshot(): PrinterConfig | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(PRINTER_CONFIG_KEY)
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  cachedValue = getPrinterConfig()
  return cachedValue
}

function getServerSnapshot(): PrinterConfig | null {
  return null
}

const localSubscribers = new Set<() => void>()

function notifyLocalChange() {
  cachedRaw = undefined
  localSubscribers.forEach((cb) => cb())
}

function subscribe(callback: () => void): () => void {
  localSubscribers.add(callback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === PRINTER_CONFIG_KEY) {
      cachedRaw = undefined
      callback()
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    localSubscribers.delete(callback)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

export function usePrinter() {
  const config = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot)
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<PrinterError | null>(null)

  const saveConfig = useCallback((next: PrinterConfig) => {
    setPrinterConfig(next)
    notifyLocalChange()
  }, [])

  const removeConfig = useCallback(() => {
    clearPrinterConfig()
    notifyLocalChange()
  }, [])

  const print = useCallback(async (data: ReceiptData): Promise<PrintResult> => {
    setStatus('printing')
    setLastError(null)
    const result = await printReceipt(data)
    if (result.ok) {
      setStatus('idle')
    } else {
      setStatus('error')
      setLastError(result.error)
    }
    return result
  }, [])

  // Re-pairs the USB device (requires a user gesture in scope) and updates
  // both localStorage and DB so the new IDs survive the next restart.
  // Returns true if a new device was successfully selected.
  const repairDevice = useCallback(async (): Promise<boolean> => {
    const current = getPrinterConfig()
    if (!current || current.transport !== 'usb') return false
    const result = await requestUsbDevice()
    if (!result.ok) return false
    const updated: PrinterConfig = {
      ...current,
      usb: { vendorId: result.vendorId, productId: result.productId },
    }
    setPrinterConfig(updated)
    notifyLocalChange()
    savePrinterConfigToDB(updated)
    return true
  }, [])

  return {
    config,
    isConfigured: Boolean(config?.enabled),
    saveConfig,
    removeConfig,
    print,
    repairDevice,
    status,
    lastError,
  }
}
