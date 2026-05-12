# Thermal Receipt Printing (ESC/POS) — Design Spec

**Date:** 2026-05-12
**Status:** Approved (brainstorming)
**Scope:** Add dedicated thermal printer support to the POS receipt flow, alongside the existing HTML `window.print()` path.

## 1. Goals

- Print POS receipts on dedicated thermal printers (typically 80mm, sometimes 58mm).
- Support three transports: **USB** (WebUSB), **Network** (TCP/IP via Next.js API route), **Bluetooth** (Web Bluetooth).
- Configurable per cash register (not per user), persisted locally.
- Optional auto-print after checkout (skip preview modal).
- Graceful fallback to the existing HTML print path when no thermal printer is configured or when the configured printer fails.
- Work offline (USB/Bluetooth are inherently local; LAN TCP works without internet).

## 2. Non-goals

- Cash drawer integration (deferred — placeholder in config only).
- Real-time printer status polling (paper out, cover open). Errors are surfaced on print attempt.
- Proforma A4 invoices — they keep `html2pdf.js` / HTML print.
- Multiple simultaneous printers per register.
- Linux/Windows driver configuration (out of app scope — documented in user guide).

## 3. Library choice

**`@point-of-sale/receipt-printer-encoder`** (modern, maintained successor of `esc-pos-encoder`):
- Pure JS, browser-compatible (no Node deps for encoding).
- Handles codepages, images (dithering), barcodes/QR codes, cut commands.
- Declarative builder API: `.initialize().codepage('cp858').text('...').newline().cut()`.
- ~30 KB gzipped.

Alternative considered: hand-written encoder (rejected — codepage handling and image dithering are non-trivial).

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│  UI Layer                                   │
│  - components/pos/pos-receipt.tsx (modified)│
│  - components/settings/printer-settings.tsx │
│  - hooks/use-printer.ts                     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  lib/printing/printer-service.ts            │
│  (façade: routes to active transport)       │
└──────┬──────────────┬──────────────┬────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼─────┐
│ transports/ │ │transports/│ │transports/ │
│   usb.ts    │ │ bluetooth │ │ network.ts │
│             │ │   .ts     │ │            │
└──────┬──────┘ └─────┬─────┘ └──────┬─────┘
       │              │              │
       │              │       ┌──────▼────────┐
       │              │       │ POST /api/    │
       │              │       │ printing/tcp  │
       │              │       └───────────────┘
       │              │
       └──────────────┴──────────┐
                                 │
              ┌──────────────────▼──────────────┐
              │  lib/printing/encoder.ts        │
              │  encodeReceipt(data, config)    │
              │    → Uint8Array (ESC/POS bytes) │
              └─────────────────────────────────┘
```

### 4.1 Files to create

| Path | Responsibility |
|------|----------------|
| `lib/printing/types.ts` | `PrinterConfig`, `PrintResult`, `PrinterError` types |
| `lib/printing/encoder.ts` | Pure: `encodeReceipt(ReceiptData, PrinterConfig) → Uint8Array` |
| `lib/printing/config.ts` | `getConfig()`, `setConfig()`, persistence in `localStorage` |
| `lib/printing/printer-service.ts` | `print(receiptData)` façade — picks transport, handles errors |
| `lib/printing/transports/usb.ts` | WebUSB: `requestDevice()`, `connect()`, `send(bytes)` |
| `lib/printing/transports/bluetooth.ts` | Web Bluetooth: `requestDevice()`, GATT write |
| `lib/printing/transports/network.ts` | Browser-side: POST to API route |
| `app/api/printing/tcp/route.ts` | Server: TCP socket via `node:net` |
| `lib/hooks/use-printer.ts` | React hook exposing `print`, `status`, `error`, `isConfigured` |
| `components/settings/printer-settings.tsx` | Config UI (transport, pair, test print) |
| `app/(dashboard)/settings/printer/page.tsx` | Settings route |
| `tests/unit/printing/encoder.test.ts` | Vitest snapshots of encoded bytes |

### 4.2 Files to modify

| Path | Change |
|------|--------|
| `components/pos/pos-receipt.tsx` | If thermal config present and auto-print on → call `printerService.print()` directly and close modal; else keep current HTML path. Add "Print on thermal printer" button when config present but auto-print off. |
| `components/pos/pos-cart.tsx` | If `autoPrint`, skip opening the receipt modal entirely on success; show toast with print status instead. |
| `package.json` | Add `@point-of-sale/receipt-printer-encoder` dependency |

## 5. Data model

```ts
// lib/printing/types.ts
export type PrinterTransport = 'usb' | 'bluetooth' | 'network'

export type PrinterConfig = {
  enabled: boolean
  transport: PrinterTransport
  width: 58 | 80              // mm — column count derived (32 / 48)
  codepage: string            // default 'cp858' (covers FR + €)
  autoCut: boolean            // send GS V cut after print
  autoPrint: boolean          // skip preview modal on checkout success
  storeLogo: boolean          // print logo (requires logo cached as bitmap)
  usb?: {
    vendorId: number
    productId: number
  }
  bluetooth?: {
    deviceId: string          // returned by browser, stable across sessions
    serviceUuid: string
    characteristicUuid: string
  }
  network?: {
    host: string              // IP or hostname
    port: number              // default 9100 (RAW)
    timeoutMs: number         // default 5000
  }
}

export type PrintResult =
  | { ok: true }
  | { ok: false; error: PrinterError }

export type PrinterError =
  | { kind: 'not-configured' }
  | { kind: 'permission-denied' }
  | { kind: 'device-not-found' }
  | { kind: 'transport-error'; message: string }
  | { kind: 'encoding-error'; message: string }
```

**Persistence:** `localStorage` under key `pos.printer.config.v1`. Per browser/device, not synced across registers. Cleared on logout? **No** — printer is tied to the physical register, not the user.

## 6. Encoder behavior

`encodeReceipt(data: ReceiptData, config: PrinterConfig): Uint8Array`

Produces an ESC/POS byte stream matching the visual layout of the current HTML receipt:

1. `initialize()` + `codepage(config.codepage)`
2. Centered, bold: `data.store.name`
3. Centered, small: address + phone (if present)
4. Separator line (`-` × column count)
5. Receipt number + date (left aligned)
6. Cashier name (left aligned, small)
7. Separator
8. For each item: `name × qty` (left, truncated to column width - price width) + price (right) — two columns
9. If item discount > 0: indented `- remise: -X CFA`
10. Separator
11. `Sous-total` ... `Total` (bold, larger). Tax line if present. Discount line if present.
12. Payment method
13. Separator
14. Centered: "Merci !"
15. Notes if present (italic substitute — most printers don't have italic, fall back to plain)
16. Feed 3 lines + `autoCut` if enabled

**Column widths:** 32 chars for 58mm, 48 chars for 80mm. Computed from `config.width`.

**Currency:** `formatCurrency` reused from existing receipt component (extract to `lib/format.ts` if not already there).

## 7. Transports

### 7.1 USB (WebUSB)

```ts
// lib/printing/transports/usb.ts
export async function requestUsbDevice(): Promise<USBDevice>
export async function printUsb(bytes: Uint8Array, config: PrinterConfig['usb']): Promise<void>
```

- Filter: known thermal printer vendor IDs in a curated list (`THERMAL_VENDOR_IDS = [0x04b8 /* Epson */, 0x0519 /* Star */, 0x0fe6 /* Generic */, ...]`), but user can pick any.
- On `requestDevice`, save `vendorId`/`productId` to config.
- On print: `navigator.usb.getDevices()` → find by IDs → `open()` → `selectConfiguration(1)` → `claimInterface(0)` → find OUT endpoint → `transferOut(endpoint, bytes)` → `releaseInterface()` → `close()`.
- Wrap in try/finally to always release.

### 7.2 Bluetooth (Web Bluetooth)

```ts
export async function requestBluetoothDevice(): Promise<BluetoothDevice>
export async function printBluetooth(bytes: Uint8Array, config: PrinterConfig['bluetooth']): Promise<void>
```

- Filter by common thermal printer service UUIDs (`000018f0-0000-1000-8000-00805f9b34fb` is common for cheap thermal printers).
- Chunk bytes to fit MTU (default 20 bytes for BLE without negotiation, or larger if negotiated).
- Connect → discover service → write to characteristic in chunks → disconnect.

### 7.3 Network (TCP)

**Browser-side (`transports/network.ts`):**
```ts
export async function printNetwork(
  bytes: Uint8Array,
  config: NonNullable<PrinterConfig['network']>
): Promise<void>
```
POSTs to `/api/printing/tcp` with `{ host, port, timeoutMs, payload: base64(bytes) }`.

**Server-side (`app/api/printing/tcp/route.ts`):**
- `POST` handler
- Auth: requires authenticated Supabase session (reuse `createClient` from `lib/supabase/server.ts`)
- Optional: rate-limit per user (e.g., 10/min) to prevent abuse
- Validate body with Zod (`host` is non-empty string, `port` 1-65535, payload is base64, timeout 1000-30000)
- Open TCP socket via `node:net`, write bytes, end, close
- **Important:** restrict allowed hosts to **private IP ranges only** (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) to prevent the server from being used as an open relay against arbitrary hosts (SSRF). Configurable via env var `PRINTING_TCP_ALLOWLIST` if a custom range is needed.
- Returns `{ ok: true }` or `{ ok: false, error: 'connection-refused' | 'timeout' | ... }`

## 8. UI changes

### 8.1 Modified `pos-receipt.tsx`

- If `config.enabled && config.autoPrint` → caller (`pos-cart.tsx`) does **not** open the modal. Instead, `printerService.print()` is called directly, and a `sonner` toast shows status.
- If `config.enabled && !config.autoPrint` → modal opens as today; the "Imprimer" button now calls `printerService.print()` (thermal) instead of `window.print()`. A secondary "Aperçu navigateur" button keeps the old behavior for fallback.
- If `!config.enabled` → unchanged from today.

### 8.2 New `printer-settings.tsx` (route: `/settings/printer`)

Sections:
1. **Activation** — toggle "Activer l'impression thermique"
2. **Transport** — radio (USB / Bluetooth / Réseau)
3. **Per-transport pairing**:
   - USB: "Sélectionner imprimante USB" button → `navigator.usb.requestDevice()` → store IDs
   - Bluetooth: "Scanner imprimantes Bluetooth" → `navigator.bluetooth.requestDevice()`
   - Réseau: text input for host + port (default 9100)
4. **Format** — radio 58mm / 80mm + codepage select (cp858 default, cp1252, cp437)
5. **Options** — checkboxes: auto-cut, auto-print après vente, logo magasin
6. **Test** — "Imprimer un ticket de test" button (uses a hardcoded sample `ReceiptData`)

Access control: only `admin` and `manager` roles can edit. `cashier` can view current config.

## 9. Hook API

```ts
// lib/hooks/use-printer.ts
export function usePrinter() {
  return {
    isConfigured: boolean,
    config: PrinterConfig | null,
    print: (data: ReceiptData) => Promise<PrintResult>,
    testPrint: () => Promise<PrintResult>,
    status: 'idle' | 'printing' | 'error',
    lastError: PrinterError | null,
  }
}
```

## 10. Error handling & fallback

When `printerService.print()` returns `{ ok: false }`:

| Error kind | UI response |
|------------|-------------|
| `not-configured` | Open HTML receipt modal (current behavior) |
| `permission-denied` | Toast: "Autorisez l'imprimante dans les réglages du navigateur" + open HTML modal |
| `device-not-found` | Toast: "Imprimante introuvable" + open HTML modal |
| `transport-error` | Toast with message + open HTML modal |
| `encoding-error` | Toast: "Erreur d'encodage" + open HTML modal — also log to console |

The HTML modal therefore remains the universal fallback. The cashier is never blocked from giving the customer a receipt.

## 11. Offline behavior

- USB & Bluetooth: 100% local, work offline.
- Network: works if the printer is on the same LAN as the cash register; fails if printer is internet-routed (unusual).
- The offline checkout queue in `lib/offline/` already builds `ReceiptData` via `buildReceiptFromTransaction`. Thermal printing plugs in at the same hook point — no changes to the offline pipeline.

## 12. Security considerations

- **WebUSB/WebBluetooth** require a user gesture and explicit per-device consent. Permissions persist per origin.
- **TCP API route** must be authenticated and must restrict target IPs to private ranges (SSRF protection). See §7.3.
- **HTTPS required** for WebUSB and Web Bluetooth in production. Already the case.
- **No PII leaked**: receipt content sent over USB/BT stays local; over the network it goes only to the configured LAN printer. The Next.js API never logs the payload.

## 13. Testing strategy

### 13.1 Unit (Vitest)
- `encoder.test.ts`: snapshot tests for canonical receipts (small/large, with/without tax, with/without discount, 58mm vs 80mm). Snapshots are hex dumps of `Uint8Array`.
- `config.test.ts`: round-trip serialize/parse, schema migration if needed.
- `network.api.test.ts` (server route): mock `node:net`, verify SSRF allowlist rejects public IPs.

### 13.2 Manual
- Test matrix in `docs/printing/manual-test-matrix.md`:
  - 1× Epson TM-T20 (USB) — golden reference
  - 1× generic Xprinter 80mm (USB + LAN)
  - 1× cheap BT thermal printer (58mm)
- Verify: French accents render correctly (codepage), totals align, cut works, paper feeds correctly.

### 13.3 No DB tests
- No schema changes → no pgTAP.

## 14. Delivery phases

| Phase | Scope | Acceptance |
|-------|-------|------------|
| **1** | Encoder + USB transport + settings page (USB section, format, auto-cut, auto-print toggle) + `pos-receipt` integration + unit tests | Cashier can pair a USB printer, run "test print", checkout and print a real receipt with auto-print on/off. HTML fallback works. |
| **2** | Network transport + API route + settings UI for network + SSRF allowlist + unit + integration tests | Cashier can configure a LAN printer by IP, print receipts. |
| **3** | Bluetooth transport + settings UI for BT + chunking | Cashier can pair a BT printer, print receipts. |
| **4** | Store logo printing + cash drawer kick (optional ESC `p` command) + status feedback polish | Logo and drawer-kick optional in settings; richer error feedback in toasts. |

Each phase ships an independent PR. Phase 1 alone delivers value.

## 15. Open questions / deferred

- **Cash drawer**: most ESC/POS thermal printers can kick a cash drawer via `ESC p 0 25 250`. Stub in config (`kickDrawer: boolean`), implement in Phase 4.
- **Multiple printers per register** (e.g., kitchen printer + customer receipt): not supported in v1.
- **Star Graphics Mode** printers (different command set): out of scope — the encoder library does support `language: 'star-prnt'` if needed later.
- **Mobile money QR receipts**: the encoder supports QR; defer until business asks.

## 16. Glossary

- **ESC/POS**: Epson Standard Code for Point of Sale — a de facto standard set of escape commands for thermal printers.
- **WebUSB**: Browser API to talk to USB devices directly (Chromium-only).
- **Web Bluetooth**: Browser API for Bluetooth Low Energy (Chromium-only).
- **Codepage**: 8-bit character encoding used by the printer; `cp858` covers French + €.
- **Column width**: number of monospace characters per line — 32 for 58mm paper, 48 for 80mm.
