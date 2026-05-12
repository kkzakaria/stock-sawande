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
  // Replace any non-ASCII whitespace (U+00A0, U+202F, etc.) with a regular ASCII space
  const ascii = fixed.replace(/\s/g, ' ')
  return `${ascii} CFA`
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

  let chain = encoder.initialize().codepage(config.codepage).newline()

  chain = chain.align('center').bold(true).text(data.store.name).newline().bold(false)
  if (data.store.address) chain = chain.text(data.store.address).newline()
  if (data.store.phone) chain = chain.text(`Tel: ${data.store.phone}`).newline()

  chain = chain.text('-'.repeat(columns)).newline().align('left')

  chain = chain
    .text(`Ticket #${data.sale_number}`)
    .newline()
    .text(formatDate(data.created_at))
    .newline()
  if (data.cashier.full_name) {
    chain = chain.text(`Caissier: ${data.cashier.full_name}`).newline()
  }

  chain = chain.text('-'.repeat(columns)).newline()

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

  chain = chain.newline().newline().newline()
  if (config.autoCut) {
    chain = chain.cut('partial')
  }

  return chain.encode()
}
