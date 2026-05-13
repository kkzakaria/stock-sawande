import type { ReceiptData } from '@/components/pos/pos-receipt'
import { getPrinterConfig } from './config'
import { encodeReceipt } from './encoder'
import { printUsb } from './transports/usb'
import type { PrintResult } from './types'

export async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  const config = getPrinterConfig()
  if (!config || !config.enabled) {
    return { ok: false, error: { kind: 'not-configured' } }
  }

  let bytes: Uint8Array
  try {
    bytes = encodeReceipt(data, config)
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'encoding-error',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }

  switch (config.transport) {
    case 'usb': {
      if (!config.usb) {
        return {
          ok: false,
          error: { kind: 'transport-error', message: 'USB ids missing in config' },
        }
      }
      return printUsb(bytes, config.usb)
    }
    case 'bluetooth':
    case 'network':
      // Implemented in later phases. Treat as not-configured for now.
      return { ok: false, error: { kind: 'not-configured' } }
  }
}
