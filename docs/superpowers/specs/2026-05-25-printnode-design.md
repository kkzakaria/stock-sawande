# PrintNode Integration — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Problem

The `network` transport (TCP proxy via `/api/printing/tcp`) times out in production because Vercel's serverless functions cannot reach a private LAN IP (192.168.x.x). It only works when the Next.js server is on the same local network as the printer (i.e., localhost development).

## Solution

Replace the `network` transport with a `printnode` transport. The browser sends ESC/POS bytes (base64) to a Next.js server action, which submits a print job to the PrintNode cloud API. The PrintNode client installed on the store's PC picks up the job and delivers it to the local printer via TCP.

PrintNode API key is stored as a Vercel environment variable (`PRINTNODE_API_KEY`). It never reaches the browser.

## Architecture

```
Browser (printer-service.ts)
  │
  ├─ transport: 'usb'        → printUsb()        → WebUSB API
  ├─ transport: 'printnode'  → printPrintNode()   → Server Action (sendToPrintNode)
  │                                                      │
  │                                            reads PRINTNODE_API_KEY (Vercel env var)
  │                                            POST https://api.printnode.com/printjobs
  │                                                      │
  │                                            PrintNode client (PC du magasin)
  │                                                      │
  │                                            TCP → Thermal printer
  └─ transport: 'bluetooth'  → not implemented
```

## Data Flow

1. `printReceipt()` in `printer-service.ts` encodes ESC/POS bytes via `encodeReceipt()`
2. Dispatches to `printPrintNode(bytes, { printerId, printerName })`
3. `printPrintNode` converts `Uint8Array` to base64 string (client-side)
4. Calls server action `sendToPrintNode(printerId, base64)`
5. Server action reads `PRINTNODE_API_KEY`, POSTs to PrintNode API
6. Returns `PrintResult` to caller

## PrintNode API

**List printers:**
```
GET https://api.printnode.com/printers
Authorization: Basic base64(API_KEY + ":")
```
Response: `Array<{ id: number; name: string; state: string; ... }>`

**Submit print job:**
```
POST https://api.printnode.com/printjobs
Authorization: Basic base64(API_KEY + ":")
Content-Type: application/json

{
  "printer": <printerId>,
  "title": "Reçu",
  "contentType": "raw_base64",
  "content": "<base64 ESC/POS bytes>",
  "source": "sawande-pos"
}
```
Response: job ID (number) on success, error object on failure.

## Types (`lib/printing/types.ts`)

```ts
export type PrinterTransport = 'usb' | 'bluetooth' | 'printnode'

export type PrinterConfig = {
  // ... existing fields ...
  printnode?: {
    printerId: number
    printerName: string  // display only, not sent to API
  }
  // network?: removed
}
```

## Files Changed

| File | Change |
|---|---|
| `lib/printing/types.ts` | `'network'` → `'printnode'`; replace `network?` with `printnode?` |
| `lib/printing/config.ts` | Update `VALID_TRANSPORTS`; update `isPrinterConfigShape` validator |
| `lib/printing/transports/network.ts` | Rename → `printnode.ts`; replace TCP fetch with `sendToPrintNode` call |
| `lib/actions/printing.ts` | **New** — `fetchPrintNodePrinters()` + `sendToPrintNode()` server actions |
| `lib/printing/printer-service.ts` | `case 'network'` → `case 'printnode'`; import `printPrintNode` |
| `app/api/printing/tcp/route.ts` | **Delete** |
| `components/settings/printer-settings-tab.tsx` | Replace host/port block with PrintNode printer selector |
| `messages/fr.json` | Update `transportNetwork` → PrintNode label; add new keys |
| `messages/en.json` | Same |
| `tests/unit/printing/network-api.test.ts` | Rename → `printnode.test.ts`; rewrite for PrintNode |

## Server Actions (`lib/actions/printing.ts`)

### `fetchPrintNodePrinters()`

```ts
// Returns list of printers on the PrintNode account.
// Returns { success: false, error: 'not-configured' } if API key is absent.
async function fetchPrintNodePrinters(): Promise<
  | { success: true; data: Array<{ id: number; name: string; state: string }> }
  | { success: false; error: string }
>
```

### `sendToPrintNode(printerId, base64Payload)`

```ts
// Submits a raw ESC/POS print job to PrintNode.
// Returns PrintResult so printer-service can handle it uniformly.
async function sendToPrintNode(
  printerId: number,
  base64Payload: string,
): Promise<PrintResult>
```

Auth for both: `Authorization: Basic ${Buffer.from(apiKey + ':').toString('base64')}`

## Settings UI

When `transport === 'printnode'`:

```
┌─────────────────────────────────────────┐
│ Imprimante PrintNode                    │
│                                         │
│ [Charger les imprimantes ↻]             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ HP LaserJet (id: 12345)    ▼   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- "Charger les imprimantes" → calls `fetchPrintNodePrinters()`, populates `<Select>`
- If `PRINTNODE_API_KEY` is not set: button disabled + info banner "Clé API PrintNode non configurée — contactez votre administrateur"
- If list is empty: message "Aucune imprimante trouvée sur le compte PrintNode"
- Selected printer ID + name stored in `config.printnode`

## Error Handling

| Scenario | `PrinterError` |
|---|---|
| `PRINTNODE_API_KEY` not set | `transport-error: 'PrintNode not configured'` |
| `config.printnode` missing | `transport-error: 'PrintNode printer not configured'` |
| PrintNode API error (4xx/5xx) | `transport-error: <HTTP status message>` |
| Network failure reaching PrintNode | `transport-error: <fetch error message>` |
| Printer offline at print time | `{ ok: true }` — PrintNode queues the job |

## Migration

Existing stored configs with `transport: 'network'` fail `isPrinterConfigShape` validation → `getPrinterConfig()` returns `null` → UI falls back to `DEFAULT_PRINTER_CONFIG` (`transport: 'usb'`). User reconfigures PrintNode once. No DB migration needed.

## Testing

**`tests/unit/printing/printnode.test.ts`:**
- `sendToPrintNode` with no `PRINTNODE_API_KEY` → returns `transport-error`
- `sendToPrintNode` with valid key → mocks fetch, verifies base64 payload + Basic auth header
- `sendToPrintNode` with HTTP 4xx response → returns `transport-error`
- `fetchPrintNodePrinters` with no key → returns `not-configured`
- `fetchPrintNodePrinters` with valid key → returns parsed printer list

## Out of Scope

- PrintNode account creation / billing (user handles externally)
- Printer status polling / real-time feedback after job submission
- Multiple PrintNode accounts per organization (single env var)
- Bluetooth transport (remains disabled)
