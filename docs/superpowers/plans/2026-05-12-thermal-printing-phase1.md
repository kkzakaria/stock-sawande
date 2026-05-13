# Thermal Printing — Phase 1 (USB) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add USB thermal receipt printing (ESC/POS) to the POS, alongside the existing HTML `window.print()` fallback. Cashier pairs a USB printer once via a settings tab, then prints (manually or auto) directly after checkout.

**Architecture:** A `lib/printing/` module with a thin façade (`printer-service`) routing to a USB transport (WebUSB). The encoder is a pure function `ReceiptData → Uint8Array` using `@point-of-sale/receipt-printer-encoder`. Config is persisted to `localStorage` per browser/register. UI is a new tab in the existing settings page; print is triggered from the receipt modal and (optionally) auto-fired by the cart.

**Tech Stack:** Next.js 16 client components, React 19, TypeScript, Vitest (unit), `@point-of-sale/receipt-printer-encoder`, WebUSB browser API, `next-intl` for translations, sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-05-12-thermal-printing-design.md`

---

## File Structure (Phase 1)

**Create:**
- `lib/printing/types.ts` — `PrinterConfig`, `PrinterTransport`, `PrintResult`, `PrinterError` types
- `lib/printing/encoder.ts` — pure `encodeReceipt(data, config) → Uint8Array`
- `lib/printing/config.ts` — `getPrinterConfig()`, `setPrinterConfig()`, `clearPrinterConfig()` (localStorage)
- `lib/printing/transports/usb.ts` — `requestUsbDevice()`, `printUsb()`, `listKnownUsbDevices()`
- `lib/printing/printer-service.ts` — `printReceipt()` façade (Phase 1: routes to USB only)
- `lib/hooks/use-printer.ts` — React hook wrapping the service
- `components/settings/printer-settings-tab.tsx` — settings tab UI
- `tests/unit/printing/encoder.test.ts` — encoder snapshot tests
- `tests/unit/printing/config.test.ts` — config round-trip tests
- `tests/unit/printing/printer-service.test.ts` — service routing tests with mocked transport
- `tests/unit/printing/fixtures.ts` — shared `ReceiptData` + `PrinterConfig` fixtures

**Modify:**
- `package.json` — add `@point-of-sale/receipt-printer-encoder`
- `components/settings/settings-tabs.tsx` — register the new Printer tab
- `components/pos/pos-receipt.tsx` — call `printerService.printReceipt()` from the Imprimer button when configured; fallback to `window.print()` on failure or when not configured
- `components/pos/pos-cart.tsx` — when `autoPrint` is enabled and config present, skip the modal and fire-and-forget `printerService.printReceipt()` with toast feedback; on failure, open the modal as today
- `messages/en.json`, `messages/fr.json` — add `Settings.printer.*` and `POS.print.*` strings

**Not changed in Phase 1:** any DB schema, API routes (Phase 2), offline pipeline, proforma receipts, settings page route, locale routing.

---

## Task 1 — Install encoder library

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Add the dependency**

Run from repo root:
```bash
pnpm add @point-of-sale/receipt-printer-encoder
```
Expected: package added to `dependencies`, lockfile updated.

- [ ] **Step 2: Verify build/types still pass**

Run:
```bash
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add @point-of-sale/receipt-printer-encoder"
```

---

## Task 2 — Printing types

**Files:**
- Create: `lib/printing/types.ts`

- [ ] **Step 1: Create the types file**

Write `lib/printing/types.ts`:
```ts
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
```

- [ ] **Step 2: Verify it type-checks**

Run:
```bash
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/printing/types.ts
git commit -m "feat(printing): add PrinterConfig and PrintResult types"
```

---

## Task 3 — Test fixtures

**Files:**
- Create: `tests/unit/printing/fixtures.ts`

- [ ] **Step 1: Create shared test fixtures**

Write `tests/unit/printing/fixtures.ts`:
```ts
import type { ReceiptData } from '@/components/pos/pos-receipt'
import type { PrinterConfig } from '@/lib/printing/types'
import { DEFAULT_PRINTER_CONFIG } from '@/lib/printing/types'

export const sampleReceiptData: ReceiptData = {
  id: 'sale-1',
  sale_number: 'V-000123',
  subtotal: 12000,
  tax: 0,
  discount: null,
  total: 12000,
  payment_method: 'cash',
  created_at: '2026-05-12T19:00:00.000Z',
  notes: null,
  store: {
    name: 'Sawandé Boutique',
    address: 'Cocody, Abidjan',
    phone: '+225 07 00 00 00',
  },
  cashier: { full_name: 'Aïcha Koné' },
  sale_items: [
    {
      product: { name: 'Café arabica 250g', sku: 'COF-250' },
      quantity: 2,
      unit_price: 3000,
      subtotal: 6000,
      discount: null,
    },
    {
      product: { name: 'Sucre raffiné 1kg', sku: 'SUC-1KG' },
      quantity: 3,
      unit_price: 2000,
      subtotal: 6000,
      discount: 500,
    },
  ],
}

export const config80mm: PrinterConfig = {
  ...DEFAULT_PRINTER_CONFIG,
  enabled: true,
  width: 80,
  usb: { vendorId: 0x04b8, productId: 0x0202 },
}

export const config58mm: PrinterConfig = {
  ...DEFAULT_PRINTER_CONFIG,
  enabled: true,
  width: 58,
  usb: { vendorId: 0x04b8, productId: 0x0202 },
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/unit/printing/fixtures.ts
git commit -m "test(printing): add shared receipt and config fixtures"
```

---

## Task 4 — Encoder (TDD)

**Files:**
- Create: `lib/printing/encoder.ts`
- Test: `tests/unit/printing/encoder.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/unit/printing/encoder.test.ts`:
```ts
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
    // GS V (0x1d 0x56) is the cut command family
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
pnpm test:unit tests/unit/printing/encoder.test.ts
```
Expected: tests fail — module `@/lib/printing/encoder` does not exist.

- [ ] **Step 3: Implement the encoder**

Write `lib/printing/encoder.ts`:
```ts
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import type { ReceiptData } from '@/components/pos/pos-receipt'
import type { PrinterConfig, PrinterWidth } from './types'

const COLUMNS: Record<PrinterWidth, number> = { 58: 32, 80: 48 }

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Especes',
  card: 'Carte bancaire',
  mobile: 'Paiement mobile',
  other: 'Autre',
}

function formatCurrency(amount: number): string {
  const fixed = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `${fixed} CFA`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function padBetween(left: string, right: string, width: number): string {
  const maxLeft = Math.max(0, width - right.length - 1)
  const truncatedLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left
  const spaces = Math.max(1, width - truncatedLeft.length - right.length)
  return truncatedLeft + ' '.repeat(spaces) + right
}

export function encodeReceipt(data: ReceiptData, config: PrinterConfig): Uint8Array {
  const columns = COLUMNS[config.width]
  const encoder = new ReceiptPrinterEncoder({
    language: 'esc-pos',
    columns,
  })

  let chain = encoder.initialize().codepage(config.codepage)

  // Header — store
  chain = chain.align('center').bold(true).text(data.store.name).newline().bold(false)
  if (data.store.address) chain = chain.text(data.store.address).newline()
  if (data.store.phone) chain = chain.text(`Tel: ${data.store.phone}`).newline()

  chain = chain.text('-'.repeat(columns)).newline().align('left')

  // Receipt meta
  chain = chain
    .text(`Ticket #${data.sale_number}`)
    .newline()
    .text(formatDate(data.created_at))
    .newline()
  if (data.cashier.full_name) {
    chain = chain.text(`Caissier: ${data.cashier.full_name}`).newline()
  }

  chain = chain.text('-'.repeat(columns)).newline()

  // Items
  for (const item of data.sale_items) {
    const left = `${item.product.name} x${item.quantity}`
    const right = formatCurrency(item.subtotal)
    chain = chain.text(padBetween(left, right, columns)).newline()
    if (item.discount && item.discount > 0) {
      chain = chain
        .text(`  remise: -${formatCurrency(item.discount)}`)
        .newline()
    }
  }

  chain = chain.text('-'.repeat(columns)).newline()

  // Totals
  chain = chain.text(padBetween('Sous-total', formatCurrency(data.subtotal), columns)).newline()
  if (data.tax > 0) {
    chain = chain.text(padBetween('TVA', formatCurrency(data.tax), columns)).newline()
  }
  if (data.discount && data.discount > 0) {
    chain = chain
      .text(padBetween('Remise', `-${formatCurrency(data.discount)}`, columns))
      .newline()
  }
  chain = chain
    .bold(true)
    .text(padBetween('TOTAL', formatCurrency(data.total), columns))
    .newline()
    .bold(false)

  const paymentLabel = PAYMENT_LABELS[data.payment_method] ?? data.payment_method
  chain = chain.text(paymentLabel).newline()

  chain = chain.text('-'.repeat(columns)).newline().align('center').text('Merci !').newline()

  if (data.notes) {
    chain = chain.align('left').newline().text(`Note: ${data.notes}`).newline()
  }

  // Feed and (optional) cut
  chain = chain.newline().newline().newline()
  if (config.autoCut) {
    chain = chain.cut('partial')
  }

  return chain.encode()
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
pnpm test:unit tests/unit/printing/encoder.test.ts
```
Expected: all 10 tests pass; snapshot files are created on first run in `tests/unit/printing/__snapshots__/`. Inspect the snapshot once for sanity — it should contain the store name and "Merci" in the byte stream.

- [ ] **Step 5: Commit**

```bash
git add lib/printing/encoder.ts tests/unit/printing/encoder.test.ts tests/unit/printing/__snapshots__/
git commit -m "feat(printing): add ESC/POS encoder for receipts"
```

---

## Task 5 — Config persistence (TDD)

**Files:**
- Create: `lib/printing/config.ts`
- Test: `tests/unit/printing/config.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/unit/printing/config.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPrinterConfig,
  setPrinterConfig,
  clearPrinterConfig,
  PRINTER_CONFIG_KEY,
} from '@/lib/printing/config'
import { DEFAULT_PRINTER_CONFIG } from '@/lib/printing/types'
import { config80mm } from './fixtures'

describe('printer config', () => {
  beforeEach(() => {
    localStorage.clear()
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
pnpm test:unit tests/unit/printing/config.test.ts
```
Expected: tests fail — `@/lib/printing/config` does not exist.

- [ ] **Step 3: Implement the config module**

Write `lib/printing/config.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
pnpm test:unit tests/unit/printing/config.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/printing/config.ts tests/unit/printing/config.test.ts
git commit -m "feat(printing): persist printer config in localStorage with validation"
```

---

## Task 6 — USB transport

**Files:**
- Create: `lib/printing/transports/usb.ts`

WebUSB types are part of `@types/w3c-web-usb` (often bundled with TS DOM lib). If `pnpm tsc --noEmit` complains about missing `USBDevice` types in Step 3, install: `pnpm add -D @types/w3c-web-usb` and re-run.

- [ ] **Step 1: Write the USB transport module**

Write `lib/printing/transports/usb.ts`:
```ts
import type { PrinterError } from '../types'

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

/**
 * Prompt the user to pick a USB device. Must be called from a user gesture.
 * Returns the device IDs on success, or a PrinterError otherwise.
 */
export async function requestUsbDevice(): Promise<
  { ok: true; vendorId: number; productId: number } | { ok: false; error: PrinterError }
> {
  if (!isWebUsbSupported()) {
    return { ok: false, error: { kind: 'unsupported-browser' } }
  }
  try {
    const device = await navigator.usb.requestDevice({ filters: [] })
    return { ok: true, vendorId: device.vendorId, productId: device.productId }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return { ok: false, error: { kind: 'device-not-found' } }
    }
    return {
      ok: false,
      error: { kind: 'permission-denied' },
    }
  }
}

async function findGrantedDevice(
  vendorId: number,
  productId: number,
): Promise<USBDevice | null> {
  const devices = await navigator.usb.getDevices()
  return (
    devices.find(
      (d) => d.vendorId === vendorId && d.productId === productId,
    ) ?? null
  )
}

function findOutEndpoint(device: USBDevice): {
  interfaceNumber: number
  endpointNumber: number
} | null {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.direction === 'out') {
            return {
              interfaceNumber: iface.interfaceNumber,
              endpointNumber: ep.endpointNumber,
            }
          }
        }
      }
    }
  }
  return null
}

export async function printUsb(
  bytes: Uint8Array,
  ids: { vendorId: number; productId: number },
): Promise<{ ok: true } | { ok: false; error: PrinterError }> {
  if (!isWebUsbSupported()) {
    return { ok: false, error: { kind: 'unsupported-browser' } }
  }

  const device = await findGrantedDevice(ids.vendorId, ids.productId)
  if (!device) {
    return { ok: false, error: { kind: 'device-not-found' } }
  }

  try {
    if (!device.opened) await device.open()
    if (device.configuration === null) await device.selectConfiguration(1)

    const endpoint = findOutEndpoint(device)
    if (!endpoint) {
      return {
        ok: false,
        error: { kind: 'transport-error', message: 'No OUT endpoint found' },
      }
    }

    await device.claimInterface(endpoint.interfaceNumber)
    try {
      // Cast to BufferSource for WebUSB lib types
      await device.transferOut(endpoint.endpointNumber, bytes as BufferSource)
    } finally {
      await device.releaseInterface(endpoint.interfaceNumber)
    }
    await device.close()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'transport-error',
        message: err instanceof Error ? err.message : String(err),
      },
    }
  }
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: no errors. If `USBDevice` is unknown, run `pnpm add -D @types/w3c-web-usb`, then re-run.

- [ ] **Step 3: Commit**

```bash
git add lib/printing/transports/usb.ts package.json pnpm-lock.yaml
git commit -m "feat(printing): add WebUSB transport for thermal printers"
```

---

## Task 7 — Printer service (TDD with mocks)

**Files:**
- Create: `lib/printing/printer-service.ts`
- Test: `tests/unit/printing/printer-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `tests/unit/printing/printer-service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sampleReceiptData, config80mm } from './fixtures'
import { setPrinterConfig, clearPrinterConfig } from '@/lib/printing/config'

vi.mock('@/lib/printing/transports/usb', () => ({
  isWebUsbSupported: vi.fn(() => true),
  printUsb: vi.fn(),
  requestUsbDevice: vi.fn(),
}))

import { printUsb } from '@/lib/printing/transports/usb'
import { printReceipt } from '@/lib/printing/printer-service'

describe('printerService.printReceipt', () => {
  beforeEach(() => {
    clearPrinterConfig()
    vi.mocked(printUsb).mockReset()
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

  it('returns not-configured when transport is network (Phase 1 unsupported)', async () => {
    setPrinterConfig({
      ...config80mm,
      transport: 'network',
      network: { host: '192.168.1.50', port: 9100, timeoutMs: 5000 },
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
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run:
```bash
pnpm test:unit tests/unit/printing/printer-service.test.ts
```
Expected: tests fail — module `@/lib/printing/printer-service` does not exist.

- [ ] **Step 3: Implement the service**

Write `lib/printing/printer-service.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run:
```bash
pnpm test:unit tests/unit/printing/printer-service.test.ts
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/printing/printer-service.ts tests/unit/printing/printer-service.test.ts
git commit -m "feat(printing): add printer service routing receipts to USB transport"
```

---

## Task 8 — `usePrinter` React hook

**Files:**
- Create: `lib/hooks/use-printer.ts`

- [ ] **Step 1: Write the hook**

Write `lib/hooks/use-printer.ts`:
```ts
'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const [config, setConfigState] = useState<PrinterConfig | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<PrinterError | null>(null)

  useEffect(() => {
    setConfigState(getPrinterConfig())
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
```

- [ ] **Step 2: Type-check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/use-printer.ts
git commit -m "feat(printing): add usePrinter hook"
```

---

## Task 9 — i18n strings

**Files:**
- Modify: `messages/en.json`, `messages/fr.json`

- [ ] **Step 1: Add English strings**

Open `messages/en.json` and add a `printer` subtree under `Settings`. Search for the existing `"Settings": {` block and add the following inside it (alongside existing keys, not replacing them):
```json
"printer": {
  "title": "Thermal printer",
  "description": "Configure a USB thermal printer for receipts.",
  "enabled": "Enable thermal printing",
  "transport": "Connection type",
  "transportUsb": "USB",
  "transportBluetooth": "Bluetooth (coming soon)",
  "transportNetwork": "Network (coming soon)",
  "width": "Paper width",
  "width58": "58 mm",
  "width80": "80 mm",
  "codepage": "Character set",
  "autoCut": "Auto-cut paper after printing",
  "autoPrint": "Print automatically after checkout",
  "pairUsb": "Pair USB printer",
  "pairedUsb": "Paired (vendor {vendorId}, product {productId})",
  "testPrint": "Print test receipt",
  "save": "Save",
  "reset": "Reset",
  "unsupported": "Your browser does not support WebUSB. Use Chrome or Edge."
}
```

Also add a `print` subtree under `POS`. Search for the existing `"POS": {` block (or `"Pos"` if that's the casing) and add:
```json
"print": {
  "starting": "Sending to printer...",
  "success": "Receipt printed",
  "failed": "Print failed, opening preview",
  "testSuccess": "Test receipt sent to printer",
  "testFailed": "Test print failed"
}
```

If the `Settings` or `POS` namespace key has different casing in your file, match it. Do **not** rename existing keys.

- [ ] **Step 2: Add French strings**

Open `messages/fr.json` and add the same trees under the matching namespaces:

Inside `Settings`:
```json
"printer": {
  "title": "Imprimante thermique",
  "description": "Configurer une imprimante thermique USB pour les tickets.",
  "enabled": "Activer l'impression thermique",
  "transport": "Type de connexion",
  "transportUsb": "USB",
  "transportBluetooth": "Bluetooth (à venir)",
  "transportNetwork": "Réseau (à venir)",
  "width": "Largeur du papier",
  "width58": "58 mm",
  "width80": "80 mm",
  "codepage": "Jeu de caractères",
  "autoCut": "Coupe automatique après impression",
  "autoPrint": "Imprimer automatiquement après la vente",
  "pairUsb": "Associer une imprimante USB",
  "pairedUsb": "Associée (vendeur {vendorId}, produit {productId})",
  "testPrint": "Imprimer un ticket test",
  "save": "Enregistrer",
  "reset": "Réinitialiser",
  "unsupported": "Votre navigateur ne supporte pas WebUSB. Utilisez Chrome ou Edge."
}
```

Inside `POS`:
```json
"print": {
  "starting": "Envoi à l'imprimante...",
  "success": "Ticket imprimé",
  "failed": "Échec d'impression, ouverture de l'aperçu",
  "testSuccess": "Ticket test envoyé à l'imprimante",
  "testFailed": "Échec du test d'impression"
}
```

- [ ] **Step 3: Verify JSON is valid**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && node -e "JSON.parse(require('fs').readFileSync('messages/fr.json'))" && echo OK
```
Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/fr.json
git commit -m "i18n(printing): add Settings.printer and POS.print strings"
```

---

## Task 10 — Printer settings tab UI

**Files:**
- Create: `components/settings/printer-settings-tab.tsx`
- Modify: `components/settings/settings-tabs.tsx`

- [ ] **Step 1: Inspect the existing settings-tabs structure**

Read `components/settings/settings-tabs.tsx` to find where tabs are registered (look for `<TabsList>` and `<TabsContent>`). Identify the `userRole` gating pattern. Note the icon import style from lucide-react.

- [ ] **Step 2: Build the tab component**

Write `components/settings/printer-settings-tab.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Printer, Loader2 } from 'lucide-react'
import { usePrinter } from '@/lib/hooks/use-printer'
import { isWebUsbSupported, requestUsbDevice } from '@/lib/printing/transports/usb'
import { DEFAULT_PRINTER_CONFIG } from '@/lib/printing/types'
import type { PrinterConfig, PrinterWidth } from '@/lib/printing/types'

const SAMPLE_TEST_RECEIPT = {
  id: 'test',
  sale_number: 'TEST-001',
  subtotal: 1000,
  tax: 0,
  discount: null,
  total: 1000,
  payment_method: 'cash',
  created_at: new Date().toISOString(),
  notes: null,
  store: { name: 'Test print', address: null, phone: null },
  cashier: { full_name: null },
  sale_items: [
    {
      product: { name: 'Test item', sku: 'TST' },
      quantity: 1,
      unit_price: 1000,
      subtotal: 1000,
      discount: null,
    },
  ],
}

interface Props {
  canEdit: boolean
}

export function PrinterSettingsTab({ canEdit }: Props) {
  const t = useTranslations('Settings.printer')
  const tPrint = useTranslations('POS.print')
  const { config: storedConfig, saveConfig, print } = usePrinter()

  const [draft, setDraft] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG)
  const [pairing, setPairing] = useState(false)
  const [testing, setTesting] = useState(false)
  const supportsUsb = isWebUsbSupported()

  useEffect(() => {
    if (storedConfig) setDraft(storedConfig)
  }, [storedConfig])

  const update = <K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const onPairUsb = async () => {
    setPairing(true)
    const result = await requestUsbDevice()
    setPairing(false)
    if (!result.ok) {
      toast.error(result.error.kind)
      return
    }
    update('usb', { vendorId: result.vendorId, productId: result.productId })
  }

  const onSave = () => {
    saveConfig(draft)
    toast.success(t('save'))
  }

  const onTest = async () => {
    setTesting(true)
    // Save first so printReceipt sees the latest config
    saveConfig(draft)
    const result = await print(SAMPLE_TEST_RECEIPT)
    setTesting(false)
    if (result.ok) toast.success(tPrint('testSuccess'))
    else toast.error(`${tPrint('testFailed')}: ${result.error.kind}`)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <Printer className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{t('title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('description')}</p>

      {!supportsUsb && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          {t('unsupported')}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="printer-enabled">{t('enabled')}</Label>
        <Switch
          id="printer-enabled"
          checked={draft.enabled}
          disabled={!canEdit}
          onCheckedChange={(v) => update('enabled', v)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('transport')}</Label>
        <RadioGroup
          value={draft.transport}
          onValueChange={(v) => update('transport', v as PrinterConfig['transport'])}
          disabled={!canEdit}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="usb" id="t-usb" />
            <Label htmlFor="t-usb">{t('transportUsb')}</Label>
          </div>
          <div className="flex items-center gap-2 opacity-50">
            <RadioGroupItem value="bluetooth" id="t-bt" disabled />
            <Label htmlFor="t-bt">{t('transportBluetooth')}</Label>
          </div>
          <div className="flex items-center gap-2 opacity-50">
            <RadioGroupItem value="network" id="t-net" disabled />
            <Label htmlFor="t-net">{t('transportNetwork')}</Label>
          </div>
        </RadioGroup>
      </div>

      {draft.transport === 'usb' && (
        <div className="space-y-2">
          <Button
            onClick={onPairUsb}
            variant="outline"
            disabled={!canEdit || !supportsUsb || pairing}
          >
            {pairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('pairUsb')}
          </Button>
          {draft.usb && (
            <p className="text-sm text-muted-foreground">
              {t('pairedUsb', {
                vendorId: `0x${draft.usb.vendorId.toString(16)}`,
                productId: `0x${draft.usb.productId.toString(16)}`,
              })}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="printer-width">{t('width')}</Label>
        <Select
          value={String(draft.width)}
          onValueChange={(v) => update('width', Number(v) as PrinterWidth)}
          disabled={!canEdit}
        >
          <SelectTrigger id="printer-width">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="58">{t('width58')}</SelectItem>
            <SelectItem value="80">{t('width80')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="printer-codepage">{t('codepage')}</Label>
        <Select
          value={draft.codepage}
          onValueChange={(v) => update('codepage', v)}
          disabled={!canEdit}
        >
          <SelectTrigger id="printer-codepage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cp858">cp858 (FR + €)</SelectItem>
            <SelectItem value="cp1252">cp1252 (Windows-1252)</SelectItem>
            <SelectItem value="cp437">cp437 (US)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="printer-autocut">{t('autoCut')}</Label>
        <Switch
          id="printer-autocut"
          checked={draft.autoCut}
          disabled={!canEdit}
          onCheckedChange={(v) => update('autoCut', v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="printer-autoprint">{t('autoPrint')}</Label>
        <Switch
          id="printer-autoprint"
          checked={draft.autoPrint}
          disabled={!canEdit}
          onCheckedChange={(v) => update('autoPrint', v)}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onSave} disabled={!canEdit}>
          {t('save')}
        </Button>
        <Button
          onClick={onTest}
          variant="outline"
          disabled={!canEdit || testing || !draft.enabled}
        >
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('testPrint')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Register the tab in `settings-tabs.tsx`**

Open `components/settings/settings-tabs.tsx`. Add:

1. At the top with the other icon imports:
```ts
import { Printer } from 'lucide-react'
```
(Merge with the existing lucide-react import line — do not duplicate.)

2. Next to the other tab imports:
```ts
import { PrinterSettingsTab } from './printer-settings-tab'
```

3. Inside the `<TabsList>`, after the last existing `<TabsTrigger>` (and matching its className), add:
```tsx
<TabsTrigger value="printer" className="...same-classes-as-others">
  <Printer className="mr-2 h-4 w-4" />
  {t('printer')}
</TabsTrigger>
```
(Copy the exact `className` from an existing trigger; the tab label key is `Settings.printer.title` — use the path the existing tabs use, e.g. `t('printer')` if the namespace is `Settings`. If existing triggers use a different translation prefix, mirror that.)

4. After the last `<TabsContent>`, add:
```tsx
<TabsContent value="printer">
  <PrinterSettingsTab canEdit={userRole === 'admin' || userRole === 'manager'} />
</TabsContent>
```

5. Add a `printer` label to the `Settings` namespace tab list in `messages/{en,fr}.json` if the existing tab labels live there. Look in `messages/en.json` for a sibling key (e.g. `categories`, `users`, `business`) at the same level as `printer.title` and add:
- `en.json`: `"printerTab": "Printer"` (key name must match the `t(...)` argument used in step 3)
- `fr.json`: `"printerTab": "Imprimante"`

If the existing tabs reference `Settings.printer.title` directly, skip this step.

- [ ] **Step 4: Type-check and lint**

Run:
```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: no errors (one pre-existing warning about `hasStoreAccess` is acceptable, not introduced here).

- [ ] **Step 5: Manual test the settings UI**

Run:
```bash
pnpm dev
```
Then in Chrome or Edge over HTTPS or localhost:
1. Log in as an admin user
2. Open Settings → Printer tab
3. Toggle "Enable thermal printing"
4. Click "Pair USB printer" — a Chrome USB picker should appear. If no printer is connected, just verify the picker opens then cancel.
5. Click "Save" — should toast success
6. Reload the page, return to the tab — values should persist

Verify in DevTools:
```js
JSON.parse(localStorage.getItem('pos.printer.config.v1'))
```
Should show the saved config.

- [ ] **Step 6: Commit**

```bash
git add components/settings/printer-settings-tab.tsx components/settings/settings-tabs.tsx messages/en.json messages/fr.json
git commit -m "feat(settings): add Printer settings tab with USB pairing and test print"
```

---

## Task 11 — Integrate thermal print into POSReceipt modal

**Files:**
- Modify: `components/pos/pos-receipt.tsx`

- [ ] **Step 1: Re-read the current handlePrint**

Read `components/pos/pos-receipt.tsx` lines 74-80 (the `handlePrint` function) and the button at lines 290-297. The current `handlePrint` calls `window.print()`. We will:
- Try thermal print first if configured.
- On failure, fall back to `window.print()`.
- On not-configured, behave as today (window.print()).

- [ ] **Step 2: Replace `handlePrint`**

In `components/pos/pos-receipt.tsx`, at the top imports add:
```ts
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { usePrinter } from '@/lib/hooks/use-printer'
```

Inside the `POSReceipt` function (after the existing `useState` calls), add:
```ts
const tPrint = useTranslations('POS.print')
const { print: thermalPrint, isConfigured } = usePrinter()
```

Replace the existing `handlePrint`:
```ts
const handlePrint = async () => {
  if (isConfigured && receiptData) {
    setAction('print')
    const toastId = toast.loading(tPrint('starting'))
    const result = await thermalPrint(receiptData)
    setAction(null)
    if (result.ok) {
      toast.success(tPrint('success'), { id: toastId })
      onOpenChange(false)
      return
    }
    toast.error(tPrint('failed'), { id: toastId })
    // Fall through to browser print as fallback
  }
  setAction('print')
  setTimeout(() => {
    window.print()
    setAction(null)
  }, 100)
}
```

- [ ] **Step 3: Type-check**

Run:
```bash
pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run `pnpm dev`. In the POS:
1. Without printer configured: open a receipt, click Imprimer → browser print dialog (unchanged behavior). PASS.
2. With printer configured but USB cable unplugged: click Imprimer → toast "Échec d'impression, ouverture de l'aperçu" → browser print dialog opens. PASS.
3. With printer configured and connected: click Imprimer → ticket prints, modal closes, toast success. PASS (if hardware available — otherwise skip and note in PR).

- [ ] **Step 5: Commit**

```bash
git add components/pos/pos-receipt.tsx
git commit -m "feat(pos): route receipt print to thermal printer when configured"
```

---

## Task 12 — Auto-print on checkout (skip modal)

**Files:**
- Modify: `components/pos/pos-cart.tsx`

- [ ] **Step 1: Locate the checkout success handler**

In `components/pos/pos-cart.tsx`, `handleCheckoutComplete` starts around line 368 and ends with `setReceiptOpen(true)` around line 430. It already is `async`. It builds the receipt in two branches (offline via `buildReceiptFromTransaction`, online via Supabase select) and calls `setReceiptData(...)` in each branch — but because `setReceiptData` is a setter, the closure's `receiptData` value is **stale** for the rest of the function. We must use a local variable.

- [ ] **Step 2: Add imports and hook**

At the top of the file, add (or merge into existing import groups):
```ts
import { usePrinter } from '@/lib/hooks/use-printer'
```
`toast` and `useTranslations` are already imported — verify by searching for `from 'sonner'` and `from 'next-intl'`. If `useTranslations` isn't imported yet in this file, add it.

Inside the `POSCart` component, near the other hook calls (above `handleCheckoutComplete`), add:
```ts
const tPrint = useTranslations('POS.print')
const { print: thermalPrint, config: printerConfig } = usePrinter()
```

- [ ] **Step 3: Refactor `handleCheckoutComplete` to track the resolved receipt locally**

Replace the body of `handleCheckoutComplete` with this version. The changes vs. the current code are:
- introduce a local `resolvedReceipt` variable populated in both branches
- after the branches, run the auto-print attempt
- only open the modal if auto-print is off, was skipped, or failed

```ts
const handleCheckoutComplete = async (
  saleId: string,
  saleNumber: string,
  isOffline?: boolean,
) => {
  setCheckoutOpen(false)
  clearCart()
  toast.success(tCheckout('saleCompleted', { number: saleNumber }))
  setCurrentSaleId(saleId)
  setCurrentSaleNumber(saleNumber)

  let resolvedReceipt: ReceiptData | null = null

  if (isOffline) {
    try {
      const transaction = await getTransaction(saleId)
      if (transaction) {
        resolvedReceipt = buildReceiptFromTransaction(transaction)
        setReceiptData(resolvedReceipt)
      }
    } catch (error) {
      console.error('Failed to load offline receipt:', error)
    }
  } else {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        sale_number,
        subtotal,
        tax,
        discount,
        total,
        payment_method,
        created_at,
        notes,
        store:stores(name, address, phone),
        cashier:profiles!sales_cashier_id_fkey(full_name),
        sale_items(
          quantity,
          unit_price,
          subtotal,
          discount,
          product:product_templates(name, sku)
        )
      `)
      .eq('id', saleId)
      .single()

    if (!error && data) {
      resolvedReceipt = data as ReceiptData
      setReceiptData(resolvedReceipt)
    }
  }

  // Refresh parent (stock quantities) regardless of print path
  onCheckoutComplete?.()

  // Auto-print: try thermal first, skip modal on success
  if (
    printerConfig?.enabled &&
    printerConfig.autoPrint &&
    resolvedReceipt
  ) {
    const toastId = toast.loading(tPrint('starting'))
    const result = await thermalPrint(resolvedReceipt)
    if (result.ok) {
      toast.success(tPrint('success'), { id: toastId })
      return
    }
    toast.error(tPrint('failed'), { id: toastId })
    // fall through to open the modal as fallback
  }

  setReceiptOpen(true)
}
```

If TypeScript complains about `data as ReceiptData` (e.g. nullable fields from the Supabase generated types), keep the existing assignment pattern from the original code (the previous `setReceiptData(data)` worked — so use the same cast/coercion, or assign through `setReceiptData` first then read back via a separate local). In any case, do not introduce an `any`.

- [ ] **Step 3: Type-check and lint**

Run:
```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run `pnpm dev`. In the POS:
1. With `autoPrint=false`: complete a checkout → modal opens (unchanged). PASS.
2. With `autoPrint=true` but no USB cable: complete a checkout → toast failure → modal opens as fallback. PASS.
3. With `autoPrint=true` and USB connected: complete a checkout → toast success → modal does **not** open, cart resets. PASS.

- [ ] **Step 5: Commit**

```bash
git add components/pos/pos-cart.tsx
git commit -m "feat(pos): auto-print receipt on checkout when enabled"
```

---

## Task 13 — Full verification pass

- [ ] **Step 1: Run the whole unit suite**

Run:
```bash
pnpm test:unit
```
Expected: all tests pass (smoke + existing + 3 new printing files).

- [ ] **Step 2: Type-check and lint**

Run:
```bash
pnpm tsc --noEmit && pnpm lint
```
Expected: no errors. The pre-existing `hasStoreAccess` unused-var warning in `lib/actions/dashboard.ts` is acceptable (not introduced by this work).

- [ ] **Step 3: Build**

Run:
```bash
pnpm build
```
Expected: build succeeds. WebUSB code only runs in the browser so SSR should not blow up — if it does, guard offending calls with `typeof navigator !== 'undefined'`.

- [ ] **Step 4: Manual acceptance test (record in PR description)**

Walk through this matrix and note PASS/FAIL/N-A for each in the PR:

| Scenario | Expected |
|----------|----------|
| Settings tab visible to admin | yes |
| Settings tab visible to manager | yes (`canEdit` true) |
| Settings tab visible to cashier | yes but `canEdit` false (controls disabled) |
| Pair USB on Firefox | "unsupported browser" banner shown |
| Pair USB on Chrome, cancel picker | toast `device-not-found`, nothing saved |
| Pair USB on Chrome, pick device | IDs saved, "Paired" label shows hex IDs |
| Save with `enabled=false` | config persists but POS uses HTML fallback |
| Test print (no hardware) | toast `testFailed: device-not-found` |
| Test print (with hardware) | ticket prints |
| Checkout without printer config | modal opens (current behavior) |
| Checkout with config, autoPrint off | modal opens; "Imprimer" calls thermal then fallback |
| Checkout with config, autoPrint on | no modal, toast success/fallback |

- [ ] **Step 5: Final commit if any docs/touch-ups**

If you adjusted anything during verification (e.g., SSR guard), commit. Otherwise there is nothing to commit — proceed to PR.

```bash
git status   # confirm clean
git log --oneline -15
```

---

## Out of Scope (deferred to later phases)

- Network transport (TCP/IP) — Phase 2 plan
- Bluetooth transport — Phase 3 plan
- Store logo bitmap — Phase 4 plan
- Cash drawer kick command — Phase 4 plan
- Real-time printer status polling (paper out) — Phase 4
- Proforma A4 thermal variant — not planned

## Verification Summary

When all tasks pass:
- All new files type-check
- Encoder + config + service have unit test coverage (~24 tests)
- A user can pair a USB printer through the UI, run a test print, and have receipts printed thermally with HTML fallback on failure
- Existing flows (HTML print, share, download, offline checkout) are unchanged when no printer is configured
