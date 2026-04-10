import { CURRENCY_CONFIG } from '@/lib/config/currency'

const currencyFormatter = new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
  minimumFractionDigits: CURRENCY_CONFIG.minimumFractionDigits ?? 0,
  maximumFractionDigits: CURRENCY_CONFIG.maximumFractionDigits ?? 0,
})

export function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} ${CURRENCY_CONFIG.symbol}`
}

export function formatNumber(value: number): string {
  return currencyFormatter.format(value)
}
