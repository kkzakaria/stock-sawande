# PrintNode Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `network` TCP transport with a `printnode` transport that submits ESC/POS print jobs to the PrintNode cloud API, which relays them to the local printer via the PrintNode client installed on the store's PC.

**Architecture:** Browser encodes ESC/POS bytes → calls `printPrintNode()` transport (client-side) → calls `sendToPrintNode()` server action → POSTs to `api.printnode.com` with `PRINTNODE_API_KEY` env var → PrintNode client on local machine delivers to printer via TCP. The API key never reaches the browser.

**Tech Stack:** Next.js 16 server actions, `fetch` (Node.js 18+), Zod (validation in `business-settings.ts`), Vitest (unit tests), next-intl, shadcn/ui Select + Button.

**Spec:** `docs/superpowers/specs/2026-05-25-printnode-design.md`

---

## File Map

**Create:**
- `lib/actions/printing.ts` — server actions: `fetchPrintNodePrinters`, `sendToPrintNode`
- `lib/printing/transports/printnode.ts` — client-side transport: `printPrintNode`
- `tests/unit/printing/printnode.test.ts` — unit tests for the two server actions

**Modify:**
- `lib/printing/types.ts` — rename transport `'network'` → `'printnode'`; replace `network?` with `printnode?`
- `lib/printing/config.ts` — update `VALID_TRANSPORTS`
- `lib/actions/business-settings.ts` — update Zod schema to match new types
- `lib/printing/printer-service.ts` — update dispatch `case 'network'` → `case 'printnode'`
- `tests/unit/printing/fixtures.ts` — add `configPrintnode` fixture
- `tests/unit/printing/printer-service.test.ts` — swap mock + update tests
- `messages/fr.json` — replace network keys with PrintNode keys
- `messages/en.json` — same
- `components/settings/printer-settings-tab.tsx` — replace host/port block with printer selector

**Delete:**
- `app/api/printing/tcp/route.ts`
- `lib/printing/transports/network.ts`
- `tests/unit/printing/network-api.test.ts`

---

## Task 1 — Update types

**Files:**
- Modify: `lib/printing/types.ts`

- [ ] **Step 1: Replace `'network'` with `'printnode'` in types**

Replace the entire content of `lib/printing/types.ts` with:

```typescript
export type PrinterTransport = 'usb' | 'bluetooth' | 'printnode'

export type PrinterWidth = 58 | 80

export type PrinterConfig = {
  enabled: boolean
  transport: PrinterTransport
  width: PrinterWidth
  codepage: string
  autoCut: boolean
  autoPrint: boolean
  /** Number of receipt copies to print per sale (1-9, default 1). */
  copies: number
  usb?: {
    vendorId: number
    productId: number
  }
  bluetooth?: {
    deviceId: string
    serviceUuid: string
    characteristicUuid: string
  }
  printnode?: {
    printerId: number
    printerName: string
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

export const MIN_COPIES = 1
export const MAX_COPIES = 9

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  enabled: false,
  transport: 'usb',
  width: 80,
  codepage: 'cp858',
  autoCut: true,
  autoPrint: false,
  copies: 1,
}
```

- [ ] **Step 2: Update `VALID_TRANSPORTS` in config**

In `lib/printing/config.ts`, change line 11:

```typescript
// Before:
const VALID_TRANSPORTS: PrinterTransport[] = ['usb', 'bluetooth', 'network']

// After:
const VALID_TRANSPORTS: PrinterTransport[] = ['usb', 'bluetooth', 'printnode']
```

- [ ] **Step 3: Update Zod schema in business-settings**

In `lib/actions/business-settings.ts`, replace the `printerConfigSchema` (lines 383–402) with:

```typescript
const printerConfigSchema = z.object({
  enabled: z.boolean(),
  transport: z.enum(['usb', 'bluetooth', 'printnode']),
  width: z.union([z.literal(58), z.literal(80)]),
  codepage: z.string(),
  autoCut: z.boolean(),
  autoPrint: z.boolean(),
  copies: z.number().int().min(MIN_COPIES).max(MAX_COPIES),
  usb: z.object({ vendorId: z.number(), productId: z.number() }).optional(),
  bluetooth: z.object({
    deviceId: z.string(),
    serviceUuid: z.string(),
    characteristicUuid: z.string(),
  }).optional(),
  printnode: z.object({
    printerId: z.number(),
    printerName: z.string(),
  }).optional(),
})
```

- [ ] **Step 4: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/printing/types.ts lib/printing/config.ts lib/actions/business-settings.ts
git commit -m "refactor(printing): rename network transport to printnode"
```

---

## Task 2 — Server actions (TDD)

**Files:**
- Create: `lib/actions/printing.ts`
- Create: `tests/unit/printing/printnode.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/printing/printnode.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendToPrintNode, fetchPrintNodePrinters } from '@/lib/actions/printing'

describe('sendToPrintNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns transport-error when PRINTNODE_API_KEY is not set', async () => {
    const result = await sendToPrintNode(123, 'SGVsbG8=')
    expect(result).toEqual({
      ok: false,
      error: { kind: 'transport-error', message: 'PrintNode not configured' },
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls PrintNode API with correct auth header and payload', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(42),
    })

    const result = await sendToPrintNode(456, 'SGVsbG8=')

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.printnode.com/printjobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Basic ' + Buffer.from('test-key-123:').toString('base64'),
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          printer: 456,
          title: 'Reçu',
          contentType: 'raw_base64',
          content: 'SGVsbG8=',
          source: 'sawande-pos',
        }),
      }),
    )
  })

  it('returns transport-error when PrintNode API returns 4xx with message', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Unauthorized' }),
    })

    const result = await sendToPrintNode(123, 'SGVsbG8=')

    expect(result).toEqual({
      ok: false,
      error: { kind: 'transport-error', message: 'Unauthorized' },
    })
  })

  it('returns transport-error when PrintNode API returns 4xx without message', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('not json')),
    })

    const result = await sendToPrintNode(123, 'SGVsbG8=')

    expect(result).toEqual({
      ok: false,
      error: { kind: 'transport-error', message: 'HTTP 503' },
    })
  })

  it('returns transport-error on network failure', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockRejectedValue(new Error('Network failure'))

    const result = await sendToPrintNode(123, 'SGVsbG8=')

    expect(result).toEqual({
      ok: false,
      error: { kind: 'transport-error', message: 'Network failure' },
    })
  })
})

describe('fetchPrintNodePrinters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns not-configured when PRINTNODE_API_KEY is not set', async () => {
    const result = await fetchPrintNodePrinters()
    expect(result).toEqual({ success: false, error: 'not-configured' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns printer list on success', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: 1, name: 'Printer A', state: 'online', extra: 'ignored' },
          { id: 2, name: 'Printer B', state: 'offline', extra: 'ignored' },
        ]),
    })

    const result = await fetchPrintNodePrinters()

    expect(result).toEqual({
      success: true,
      data: [
        { id: 1, name: 'Printer A', state: 'online' },
        { id: 2, name: 'Printer B', state: 'offline' },
      ],
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.printnode.com/printers',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Basic ' + Buffer.from('test-key-123:').toString('base64'),
        }),
      }),
    )
  })

  it('returns error on HTTP 4xx', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockResolvedValue({ ok: false, status: 403 })

    const result = await fetchPrintNodePrinters()

    expect(result).toEqual({ success: false, error: 'HTTP 403' })
  })

  it('returns error on network failure', async () => {
    vi.stubEnv('PRINTNODE_API_KEY', 'test-key-123')
    mockFetch.mockRejectedValue(new Error('DNS failure'))

    const result = await fetchPrintNodePrinters()

    expect(result).toEqual({ success: false, error: 'DNS failure' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test:unit tests/unit/printing/printnode.test.ts
```

Expected: tests fail with "Cannot find module '@/lib/actions/printing'".

- [ ] **Step 3: Create the server actions**

Create `lib/actions/printing.ts`:

```typescript
'use server'

import type { PrintResult } from '@/lib/printing/types'

export type PrintNodePrinter = {
  id: number
  name: string
  state: string
}

function buildAuthHeader(): string | null {
  const key = process.env.PRINTNODE_API_KEY
  if (!key) return null
  return 'Basic ' + Buffer.from(key + ':').toString('base64')
}

export async function fetchPrintNodePrinters(): Promise<
  { success: true; data: PrintNodePrinter[] } | { success: false; error: string }
> {
  const auth = buildAuthHeader()
  if (!auth) return { success: false, error: 'not-configured' }

  let res: Response
  try {
    res = await fetch('https://api.printnode.com/printers', {
      headers: { Authorization: auth },
    })
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }

  if (!res.ok) return { success: false, error: `HTTP ${res.status}` }

  const raw = (await res.json()) as Array<{ id: number; name: string; state: string }>
  return {
    success: true,
    data: raw.map(({ id, name, state }) => ({ id, name, state })),
  }
}

export async function sendToPrintNode(
  printerId: number,
  base64Payload: string,
): Promise<PrintResult> {
  const auth = buildAuthHeader()
  if (!auth) {
    return { ok: false, error: { kind: 'transport-error', message: 'PrintNode not configured' } }
  }

  let res: Response
  try {
    res = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer: printerId,
        title: 'Reçu',
        contentType: 'raw_base64',
        content: base64Payload,
        source: 'sawande-pos',
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: { kind: 'transport-error', message: err instanceof Error ? err.message : 'Network error' },
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (typeof body?.message === 'string') detail = body.message
    } catch {
      // keep HTTP status as fallback
    }
    return { ok: false, error: { kind: 'transport-error', message: detail } }
  }

  return { ok: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test:unit tests/unit/printing/printnode.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/printing.ts tests/unit/printing/printnode.test.ts
git commit -m "feat(printing): add PrintNode server actions with tests"
```

---

## Task 3 — PrintNode transport

**Files:**
- Create: `lib/printing/transports/printnode.ts`

- [ ] **Step 1: Create the transport**

Create `lib/printing/transports/printnode.ts`:

```typescript
import { sendToPrintNode } from '@/lib/actions/printing'
import type { PrinterError } from '../types'

export async function printPrintNode(
  bytes: Uint8Array,
  config: { printerId: number; printerName: string },
): Promise<{ ok: true } | { ok: false; error: PrinterError }> {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  return sendToPrintNode(config.printerId, base64)
}
```

- [ ] **Step 2: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/printing/transports/printnode.ts
git commit -m "feat(printing): add printnode transport"
```

---

## Task 4 — Update printer-service + fixtures + tests

**Files:**
- Modify: `lib/printing/printer-service.ts`
- Modify: `tests/unit/printing/fixtures.ts`
- Modify: `tests/unit/printing/printer-service.test.ts`

- [ ] **Step 1: Add `configPrintnode` fixture**

In `tests/unit/printing/fixtures.ts`, add after `config58mm`:

```typescript
export const configPrintnode: PrinterConfig = {
  ...DEFAULT_PRINTER_CONFIG,
  enabled: true,
  transport: 'printnode',
  printnode: { printerId: 12345, printerName: 'Test Printer' },
}
```

- [ ] **Step 2: Update `printer-service.ts`**

Replace the full content of `lib/printing/printer-service.ts` with:

```typescript
import type { ReceiptData } from '@/components/pos/pos-receipt'
import { clampCopies, getPrinterConfig } from './config'
import { encodeReceipt } from './encoder'
import { printUsb } from './transports/usb'
import { printPrintNode } from './transports/printnode'
import type { PrintResult } from './types'

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
    case 'printnode': {
      if (!config.printnode) {
        return {
          ok: false,
          error: { kind: 'transport-error', message: 'PrintNode config missing' },
        }
      }
      return printPrintNode(payload, config.printnode)
    }
    case 'bluetooth':
      return { ok: false, error: { kind: 'not-configured' } }
  }
}
```

- [ ] **Step 3: Replace `printer-service.test.ts`**

Replace the full content of `tests/unit/printing/printer-service.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sampleReceiptData, config80mm, configPrintnode } from './fixtures'
import { setPrinterConfig, clearPrinterConfig } from '@/lib/printing/config'

vi.mock('@/lib/printing/transports/usb', () => ({
  isWebUsbSupported: vi.fn(() => true),
  printUsb: vi.fn(),
  requestUsbDevice: vi.fn(),
}))

vi.mock('@/lib/printing/transports/printnode', () => ({
  printPrintNode: vi.fn(),
}))

import { printUsb } from '@/lib/printing/transports/usb'
import { printPrintNode } from '@/lib/printing/transports/printnode'
import { printReceipt } from '@/lib/printing/printer-service'

describe('printerService.printReceipt', () => {
  beforeEach(() => {
    const mockStorage: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v },
      removeItem: (k: string) => { delete mockStorage[k] },
      clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) },
      get length() { return Object.keys(mockStorage).length },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    })
    clearPrinterConfig()
    vi.mocked(printUsb).mockReset()
    vi.mocked(printPrintNode).mockReset()
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

  it('propagates the USB transport error', async () => {
    setPrinterConfig(config80mm)
    vi.mocked(printUsb).mockResolvedValue({ ok: false, error: { kind: 'device-not-found' } })
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({ ok: false, error: { kind: 'device-not-found' } })
  })

  it('returns not-configured when transport is bluetooth (unsupported)', async () => {
    setPrinterConfig({
      ...config80mm,
      transport: 'bluetooth',
      bluetooth: { deviceId: 'x', serviceUuid: 'y', characteristicUuid: 'z' },
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

  it('routes to the PrintNode transport when transport is printnode', async () => {
    setPrinterConfig(configPrintnode)
    vi.mocked(printPrintNode).mockResolvedValue({ ok: true })
    const result = await printReceipt(sampleReceiptData)
    expect(printPrintNode).toHaveBeenCalledOnce()
    expect(result).toEqual({ ok: true })
  })

  it('propagates PrintNode transport error', async () => {
    setPrinterConfig(configPrintnode)
    vi.mocked(printPrintNode).mockResolvedValue({
      ok: false,
      error: { kind: 'transport-error', message: 'PrintNode not configured' },
    })
    const result = await printReceipt(sampleReceiptData)
    expect(result).toEqual({
      ok: false,
      error: { kind: 'transport-error', message: 'PrintNode not configured' },
    })
  })

  it('returns transport-error when PrintNode config object is missing', async () => {
    const broken = { ...config80mm, transport: 'printnode' as const }
    delete (broken as Partial<typeof broken>).printnode
    setPrinterConfig(broken)
    const result = await printReceipt(sampleReceiptData)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('transport-error')
    expect(printPrintNode).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run all printing tests**

```bash
pnpm test:unit tests/unit/printing/
```

Expected: all tests pass (printnode.test.ts + printer-service.test.ts + config.test.ts + encoder.test.ts).

- [ ] **Step 5: Commit**

```bash
git add lib/printing/printer-service.ts tests/unit/printing/fixtures.ts tests/unit/printing/printer-service.test.ts
git commit -m "feat(printing): wire printnode transport in printer-service"
```

---

## Task 5 — Delete old files

**Files:**
- Delete: `app/api/printing/tcp/route.ts`
- Delete: `lib/printing/transports/network.ts`
- Delete: `tests/unit/printing/network-api.test.ts`

- [ ] **Step 1: Delete the three old files**

```bash
git rm app/api/printing/tcp/route.ts
git rm lib/printing/transports/network.ts
git rm tests/unit/printing/network-api.test.ts
```

- [ ] **Step 2: Run full test suite to confirm no breakage**

```bash
pnpm test:unit
```

Expected: all tests pass, `network-api.test.ts` no longer runs.

- [ ] **Step 3: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(printing): delete obsolete TCP proxy route and network transport"
```

---

## Task 6 — i18n strings

**Files:**
- Modify: `messages/fr.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Update `messages/fr.json`**

Inside `Settings.printer`, make these changes:

Remove:
```json
"transportNetwork": "Réseau (TCP/IP)",
"networkHost": "Adresse IP de l'imprimante",
"networkPort": "Port",
```

Add:
```json
"transportPrintnode": "Réseau (PrintNode)",
"printNodeLoad": "Charger les imprimantes",
"printNodePrinter": "Imprimante sélectionnée",
"printNodeNoPrinters": "Aucune imprimante trouvée sur le compte PrintNode",
"printNodeNotConfigured": "Clé API PrintNode non configurée — contactez votre administrateur",
```

- [ ] **Step 2: Update `messages/en.json`**

Inside `Settings.printer`, make these changes:

Remove:
```json
"transportNetwork": "Network (TCP/IP)",
"networkHost": "Printer IP address",
"networkPort": "Port",
```

Add:
```json
"transportPrintnode": "Network (PrintNode)",
"printNodeLoad": "Load printers",
"printNodePrinter": "Selected printer",
"printNodeNoPrinters": "No printers found on the PrintNode account",
"printNodeNotConfigured": "PrintNode API key not configured — contact your administrator",
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/fr.json'))" && \
node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && \
echo OK
```

Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add messages/fr.json messages/en.json
git commit -m "i18n(printing): replace network keys with printnode keys"
```

---

## Task 7 — Settings UI

**Files:**
- Modify: `components/settings/printer-settings-tab.tsx`

- [ ] **Step 1: Add PrintNode imports**

At the top of the file, add after the existing imports:

```typescript
import { fetchPrintNodePrinters } from '@/lib/actions/printing'
import type { PrintNodePrinter } from '@/lib/actions/printing'
```

- [ ] **Step 2: Add state for the printer selector**

Inside `PrinterSettingsTab`, add these state declarations after the existing `const [testing, setTesting] = useState(false)` line:

```typescript
const [printers, setPrinters] = useState<PrintNodePrinter[]>([])
const [loadingPrinters, setLoadingPrinters] = useState(false)
const [printersFetched, setPrintersFetched] = useState(false)
const [printNodeMissing, setPrintNodeMissing] = useState(false)
```

- [ ] **Step 3: Add the `onLoadPrinters` handler**

Add this after the `onPairUsb` function:

```typescript
const onLoadPrinters = async () => {
  setLoadingPrinters(true)
  setPrintNodeMissing(false)
  const result = await fetchPrintNodePrinters()
  setLoadingPrinters(false)
  setPrintersFetched(true)
  if (!result.success) {
    if (result.error === 'not-configured') {
      setPrintNodeMissing(true)
    } else {
      toast.error(result.error)
    }
    return
  }
  setPrinters(result.data)
}
```

- [ ] **Step 4: Replace the transport radio entry for network**

Find and replace this block:

```tsx
<div className="flex items-center gap-2">
  <RadioGroupItem value="network" id="t-net" />
  <Label htmlFor="t-net">{t('transportNetwork')}</Label>
</div>
```

With:

```tsx
<div className="flex items-center gap-2">
  <RadioGroupItem value="printnode" id="t-pn" />
  <Label htmlFor="t-pn">{t('transportPrintnode')}</Label>
</div>
```

- [ ] **Step 5: Replace the network settings block**

Find and replace the entire block starting with `{draft.transport === 'network' && (` and ending with its closing `)}` with:

```tsx
{draft.transport === 'printnode' && (
  <div className="space-y-3">
    {printNodeMissing && (
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        {t('printNodeNotConfigured')}
      </div>
    )}
    <Button
      variant="outline"
      disabled={loadingPrinters}
      onClick={onLoadPrinters}
    >
      {loadingPrinters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {t('printNodeLoad')}
    </Button>
    {printersFetched && printers.length === 0 && !printNodeMissing && (
      <p className="text-sm text-muted-foreground">{t('printNodeNoPrinters')}</p>
    )}
    {printers.length > 0 && (
      <div className="space-y-1">
        <Label>{t('printNodePrinter')}</Label>
        <Select
          value={draft.printnode ? String(draft.printnode.printerId) : ''}
          onValueChange={(v) => {
            const p = printers.find((pr) => String(pr.id) === v)
            if (p) update('printnode', { printerId: p.id, printerName: p.name })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('printNodePrinter')} />
          </SelectTrigger>
          <SelectContent>
            {printers.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}
    {draft.printnode?.printerName && printers.length === 0 && (
      <p className="text-sm text-muted-foreground">
        {draft.printnode.printerName} (id: {draft.printnode.printerId})
      </p>
    )}
  </div>
)}
```

- [ ] **Step 6: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/settings/printer-settings-tab.tsx
git commit -m "feat(printing): add PrintNode printer selector in settings UI"
```

---

## Task 8 — Final verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test:unit
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new errors (pre-existing warnings about `inter` and `useVirtualizer` are acceptable).

- [ ] **Step 3: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Set the env var and verify the app starts**

```bash
PRINTNODE_API_KEY=dummy npm run dev
```

Open http://localhost:3000/settings, go to the printer tab, select "Réseau (PrintNode)", click "Charger les imprimantes". Expected: button loads (may fail with API error since key is dummy — that's correct behavior).

- [ ] **Step 5: Final commit (if any stray changes)**

```bash
git status
```

If clean: done. If not, stage and commit.
