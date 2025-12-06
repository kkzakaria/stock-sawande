/**
 * Currency and Locale Configuration
 * Centralized configuration for currency formatting across the application
 */

/**
 * Application currency configuration
 * XOF: Franc CFA (West African CFA franc)
 * Used in: Benin, Burkina Faso, Côte d'Ivoire, Guinea-Bissau, Mali, Niger, Senegal, Togo
 *
 * To use XAF (Central African CFA franc) instead, change CURRENCY to 'XAF'
 */
export const CURRENCY_CONFIG = {
  /** Currency code (ISO 4217) */
  code: 'XOF' as const,

  /** Locale for number formatting */
  locale: 'fr-FR' as const,

  /** Symbol representation */
  symbol: 'CFA' as const,

  /** Minimum fraction digits (CFA francs don't use decimals) */
  minimumFractionDigits: 0,

  /** Maximum fraction digits */
  maximumFractionDigits: 0,
} as const

/**
 * Format a number as currency using the application's currency configuration
 * Format: "montant CFA" (e.g., "2000 CFA" not "CFA 2000")
 *
 * @param amount - The amount to format
 * @param options - Optional Intl.NumberFormat options to override defaults
 * @returns Formatted currency string in the format "amount CFA"
 *
 * @example
 * formatCurrency(1000) // "1 000 CFA" (with French locale spacing)
 * formatCurrency(1500.50) // "1 501 CFA" (rounded, no decimals)
 * formatCurrency(2000) // "2 000 CFA" (correct CFA format)
 */
export function formatCurrency(
  amount: number,
  options?: Partial<Intl.NumberFormatOptions>
): string {
  // Format the number without currency symbol
  const formattedNumber = new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    minimumFractionDigits: CURRENCY_CONFIG.minimumFractionDigits,
    maximumFractionDigits: CURRENCY_CONFIG.maximumFractionDigits,
    ...options,
  }).format(amount)

  // Return in the correct CFA format: "amount CFA"
  return `${formattedNumber} ${CURRENCY_CONFIG.symbol}`
}

/**
 * Format a number without currency symbol
 * @param amount - The amount to format
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1000) // "1 000"
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    minimumFractionDigits: CURRENCY_CONFIG.minimumFractionDigits,
    maximumFractionDigits: CURRENCY_CONFIG.maximumFractionDigits,
  }).format(amount)
}

/**
 * Parse a formatted currency string back to a number
 * @param value - The formatted string to parse
 * @returns Parsed number
 *
 * @example
 * parseCurrency("1 000 CFA") // 1000
 * parseCurrency("1,500") // 1500
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols, spaces, and non-numeric characters (except decimal separators)
  const cleaned = value
    .replace(/[^\d,.-]/g, '') // Remove currency symbols and spaces
    .replace(',', '.') // Normalize decimal separator

  return parseFloat(cleaned) || 0
}
