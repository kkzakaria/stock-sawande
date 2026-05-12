'use client'

import { useCallback, useLayoutEffect, useState } from 'react'
import type { ReceiptData } from '@/components/pos/pos-receipt'
import { printReceipt } from '@/lib/printing/printer-service'
import {
  getPrinterConfig,
  setPrinterConfig,
  clearPrinterConfig,
  PRINTER_CONFIG_KEY,
} from '@/lib/printing/config'
import type { PrinterConfig, PrintResult, PrinterError } from '@/lib/printing/types'

type Status = 'idle' | 'printing' | 'error'

export function usePrinter() {
  const [config, setConfigState] = useState<PrinterConfig | null>(() =>
    getPrinterConfig(),
  )
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<PrinterError | null>(null)

  useLayoutEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRINTER_CONFIG_KEY) {
        setConfigState(getPrinterConfig())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const saveConfig = useCallback((next: PrinterConfig) => {
    setPrinterConfig(next)
    setConfigState(next)
  }, [])

  const removeConfig = useCallback(() => {
    clearPrinterConfig()
    setConfigState(null)
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

  return {
    config,
    isConfigured: Boolean(config?.enabled),
    saveConfig,
    removeConfig,
    print,
    status,
    lastError,
  }
}
