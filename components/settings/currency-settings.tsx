'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { updateCurrencySettings } from '@/lib/actions/business-settings'

interface CurrencySettingsProps {
  initialData: {
    code: string
    locale: string
    symbol: string
    fractionDigits?: number
  }
}

export function CurrencySettings({ initialData }: CurrencySettingsProps) {
  const t = useTranslations('Settings.business.currency')
  const [isPending, startTransition] = useTransition()
  const [code, setCode] = useState(initialData.code)
  const [symbol, setSymbol] = useState(initialData.symbol)
  const [locale, setLocale] = useState(initialData.locale)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)

    if (!code || code.length !== 3) {
      setError('Currency code must be 3 characters')
      return
    }

    if (!symbol) {
      setError('Currency symbol is required')
      return
    }

    if (!locale) {
      setError('Locale is required')
      return
    }

    startTransition(async () => {
      const result = await updateCurrencySettings({
        code: code.toUpperCase(),
        symbol,
        locale,
        fractionDigits: initialData.fractionDigits ?? 0,
      })

      if (result.success) {
        toast.success(t('success'))
      } else {
        setError(result.error || t('error'))
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="currency-code">{t('code')}</Label>
            <Input
              id="currency-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('codePlaceholder')}
              maxLength={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-symbol">{t('symbol')}</Label>
            <Input
              id="currency-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t('symbolPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency-locale">{t('locale')}</Label>
            <Input
              id="currency-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder={t('localePlaceholder')}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('save')}
        </Button>
      </CardContent>
    </Card>
  )
}
