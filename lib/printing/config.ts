import {
  MAX_COPIES,
  MIN_COPIES,
  type PrinterConfig,
  type PrinterTransport,
  type PrinterWidth,
} from './types'

export const PRINTER_CONFIG_KEY = 'pos.printer.config.v1'

const VALID_TRANSPORTS: PrinterTransport[] = ['usb', 'bluetooth', 'network']
const VALID_WIDTHS: PrinterWidth[] = [58, 80]

export function clampCopies(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  const rounded = Math.round(value)
  if (rounded < MIN_COPIES) return MIN_COPIES
  if (rounded > MAX_COPIES) return MAX_COPIES
  return rounded
}

function isPrinterConfigShape(value: unknown): value is Omit<PrinterConfig, 'copies'> & { copies?: unknown } {
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
    if (!isPrinterConfigShape(parsed)) return null
    // copies was added after the initial config schema; default to 1 if absent
    // or out of range so older stored configs keep working without a migration.
    return {
      ...(parsed as Omit<PrinterConfig, 'copies'>),
      copies: clampCopies((parsed as { copies?: unknown }).copies),
    }
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
