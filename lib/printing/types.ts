export type PrinterTransport = 'usb' | 'bluetooth' | 'network'

export type PrinterWidth = 58 | 80

export type PrinterConfig = {
  enabled: boolean
  transport: PrinterTransport
  width: PrinterWidth
  codepage: string
  autoCut: boolean
  autoPrint: boolean
  usb?: {
    vendorId: number
    productId: number
  }
  bluetooth?: {
    deviceId: string
    serviceUuid: string
    characteristicUuid: string
  }
  network?: {
    host: string
    port: number
    timeoutMs: number
  }
}

export type PrinterError =
  | { kind: 'not-configured' }
  | { kind: 'unsupported-browser' }
  | { kind: 'permission-denied' }
  | { kind: 'device-not-found' }
  | { kind: 'transport-error'; message: string }
  | { kind: 'encoding-error'; message: string }

export type PrintResult =
  | { ok: true }
  | { ok: false; error: PrinterError }

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  enabled: false,
  transport: 'usb',
  width: 80,
  codepage: 'cp858',
  autoCut: true,
  autoPrint: false,
}
