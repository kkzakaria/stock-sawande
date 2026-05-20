'use client'

import { useState } from 'react'
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
import { DEFAULT_PRINTER_CONFIG, MAX_COPIES, MIN_COPIES } from '@/lib/printing/types'
import type { PrinterConfig, PrinterWidth } from '@/lib/printing/types'
import { clampCopies } from '@/lib/printing/config'
import type { ReceiptData } from '@/components/pos/pos-receipt'

const SAMPLE_TEST_RECEIPT: ReceiptData = {
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

export function PrinterSettingsTab() {
  const t = useTranslations('Settings.printer')
  const tPrint = useTranslations('POS.print')
  const { config: storedConfig, saveConfig, print } = usePrinter()

  // Track edits separately from storedConfig. While draftEdits is null, the form
  // mirrors the stored value (or DEFAULT when nothing is stored). The user's first
  // change forks draftEdits into an independent state. This avoids SSR hydration
  // mismatches (no setState in effect needed) while still picking up post-hydration
  // values from useSyncExternalStore.
  const [draftEdits, setDraftEdits] = useState<PrinterConfig | null>(null)
  const draft: PrinterConfig = draftEdits ?? storedConfig ?? DEFAULT_PRINTER_CONFIG
  const [pairing, setPairing] = useState(false)
  const [testing, setTesting] = useState(false)
  const supportsUsb = isWebUsbSupported()

  const update = <K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) => {
    setDraftEdits({ ...draft, [key]: value })
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
    setDraftEdits(null)
    toast.success(t('save'))
  }

  const onTest = async () => {
    setTesting(true)
    saveConfig(draft)
    const result = await print(SAMPLE_TEST_RECEIPT)
    setTesting(false)
    if (result.ok) {
      toast.success(tPrint('testSuccess'))
      return
    }
    const detail =
      'message' in result.error
        ? `${result.error.kind}: ${result.error.message}`
        : result.error.kind
    console.error('[printer] test print failed:', JSON.stringify(result.error), detail)
    toast.error(`${tPrint('testFailed')}: ${detail}`)
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
          onCheckedChange={(v) => update('enabled', v)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('transport')}</Label>
        <RadioGroup
          value={draft.transport}
          onValueChange={(v) => update('transport', v as PrinterConfig['transport'])}
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
            disabled={!supportsUsb || pairing}
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
          onCheckedChange={(v) => update('autoCut', v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="printer-autoprint">{t('autoPrint')}</Label>
        <Switch
          id="printer-autoprint"
          checked={draft.autoPrint}
          onCheckedChange={(v) => update('autoPrint', v)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="printer-copies">{t('copies')}</Label>
        <Select
          value={String(clampCopies(draft.copies))}
          onValueChange={(v) => update('copies', clampCopies(Number(v)))}
        >
          <SelectTrigger id="printer-copies">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: MAX_COPIES - MIN_COPIES + 1 }, (_, i) => MIN_COPIES + i).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t('copiesHint')}</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={onSave}>{t('save')}</Button>
        <Button
          onClick={onTest}
          variant="outline"
          disabled={testing || !draft.enabled}
        >
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('testPrint')}
        </Button>
      </div>
    </div>
  )
}
