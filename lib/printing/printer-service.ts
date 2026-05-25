import type { ReceiptData } from '@/components/pos/pos-receipt'
import { clampCopies, getPrinterConfig } from './config'
import { encodeReceipt } from './encoder'
import { printUsb } from './transports/usb'
import { printNetwork } from './transports/network'
import type { PrintResult } from './types'

/**
 * Concatenate the encoded ESC/POS stream `count` times so a single USB
 * transfer prints `count` identical copies. Each encoded receipt already
 * ends with the configured cut command, so the printer cuts between copies.
 */
function repeatBytes(bytes: Uint8Array, count: number): Uint8Array {
  if (count <= 1) return bytes
  const out = new Uint8Array(bytes.length * count)
  for (let i = 0; i < count; i += 1) {
    out.set(bytes, i * bytes.length)
  }
  return out
}

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

  const copies = clampCopies(config.copies)
  const payload = repeatBytes(bytes, copies)

  switch (config.transport) {
    case 'usb': {
      if (!config.usb) {
        return {
          ok: false,
          error: { kind: 'transport-error', message: 'USB ids missing in config' },
        }
      }
      return printUsb(payload, config.usb)
    }
    case 'network': {
      if (!config.network) {
        return {
          ok: false,
          error: { kind: 'transport-error', message: 'Network config missing' },
        }
      }
      return printNetwork(payload, config.network)
    }
    case 'bluetooth':
      return { ok: false, error: { kind: 'not-configured' } }
  }
}
