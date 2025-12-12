'use client'

import { TaxSettings } from './tax-settings'
import { CurrencySettings } from './currency-settings'
import { StockAlertSettings } from './stock-alert-settings'
import { CompanyInfoSettings } from './company-info-settings'

interface BusinessSettings {
  tax_rate: {
    rate: number
    enabled: boolean
  }
  currency: {
    code: string
    locale: string
    symbol: string
    fractionDigits?: number
  }
  stock_alerts: {
    defaultThreshold: number
    enabled: boolean
  }
  company_info: {
    name: string
    taxId: string
    address: string
    phone: string
    email: string
    website: string
    logoUrl: string
  }
}

interface BusinessSettingsTabProps {
  initialSettings?: BusinessSettings
}

const defaultSettings: BusinessSettings = {
  tax_rate: { rate: 0.0875, enabled: true },
  currency: { code: 'XOF', locale: 'fr-FR', symbol: 'CFA', fractionDigits: 0 },
  stock_alerts: { defaultThreshold: 10, enabled: true },
  company_info: {
    name: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: '',
  },
}

export function BusinessSettingsTab({ initialSettings }: BusinessSettingsTabProps) {
  const settings = initialSettings || defaultSettings

  return (
    <div className="space-y-6">
      <CompanyInfoSettings initialData={settings.company_info} />
      <TaxSettings initialData={settings.tax_rate} />
      <CurrencySettings initialData={settings.currency} />
      <StockAlertSettings initialData={settings.stock_alerts} />
    </div>
  )
}
