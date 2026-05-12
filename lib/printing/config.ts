import type { PrinterConfig, PrinterTransport, PrinterWidth } from './types'

export const PRINTER_CONFIG_KEY = 'pos.printer.config.v1'

const VALID_TRANSPORTS: PrinterTransport[] = ['usb', 'bluetooth', 'network']
const VALID_WIDTHS: PrinterWidth[] = [58, 80]

function isPrinterConfig(value: unknown): value is PrinterConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.enabled === 'boolean' &&
    typeof v.transport === 'string' &&
    VALID_TRANSPORTS.includes(v.transport as PrinterTransport) &&
    typeof v.width === 'number' &&
    VALID_WIDTHS.includes(v.width as PrinterWidth) &&
    typeof v.codepage === 'string' &&
    typeof v.autoCut === 'boolean' &&
    typeof v.autoPrint === 'boolean'
  )
}

export function getPrinterConfig(): PrinterConfig | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(PRINTER_CONFIG_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!isPrinterConfig(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function setPrinterConfig(config: PrinterConfig): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(config))
}

export function clearPrinterConfig(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(PRINTER_CONFIG_KEY)
}
