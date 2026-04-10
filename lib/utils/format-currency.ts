const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)} CFA`
}

export function formatNumber(value: number): string {
  return currencyFormatter.format(value)
}
