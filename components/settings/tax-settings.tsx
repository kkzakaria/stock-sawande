'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2, Percent } from 'lucide-react'
import { toast } from 'sonner'
import { updateTaxSettings } from '@/lib/actions/business-settings'

interface TaxSettingsProps {
  initialData: {
    rate: number
    enabled: boolean
  }
}

export function TaxSettings({ initialData }: TaxSettingsProps) {
  const t = useTranslations('Settings.business.tax')
  const [isPending, startTransition] = useTransition()
  const [rate, setRate] = useState((initialData.rate * 100).toString())
  const [enabled, setEnabled] = useState(initialData.enabled)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    const rateValue = parseFloat(rate) / 100

    if (isNaN(rateValue) || rateValue < 0 || rateValue > 1) {
      setError('Rate must be between 0 and 100')
      return
    }

    startTransition(async () => {
      const result = await updateTaxSettings({
        rate: rateValue,
        enabled,
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
          <Percent className="h-5 w-5" />
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

        <div className="flex items-center justify-between">
          <Label htmlFor="tax-enabled">{t('enabled')}</Label>
          <Switch
            id="tax-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax-rate">{t('rate')}</Label>
          <div className="relative">
            <Input
              id="tax-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={t('ratePlaceholder')}
              disabled={!enabled}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              %
            </span>
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
