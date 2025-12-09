'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { updateStockAlertSettings } from '@/lib/actions/business-settings'

interface StockAlertSettingsProps {
  initialData: {
    defaultThreshold: number
    enabled: boolean
  }
}

export function StockAlertSettings({ initialData }: StockAlertSettingsProps) {
  const t = useTranslations('Settings.business.stockAlerts')
  const [isPending, startTransition] = useTransition()
  const [threshold, setThreshold] = useState(initialData.defaultThreshold.toString())
  const [enabled, setEnabled] = useState(initialData.enabled)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    const thresholdValue = parseInt(threshold, 10)

    if (isNaN(thresholdValue) || thresholdValue < 0) {
      setError('Threshold must be a non-negative number')
      return
    }

    startTransition(async () => {
      const result = await updateStockAlertSettings({
        defaultThreshold: thresholdValue,
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
          <Bell className="h-5 w-5" />
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
          <Label htmlFor="alerts-enabled">{t('enabled')}</Label>
          <Switch
            id="alerts-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="stock-threshold">{t('threshold')}</Label>
          <Input
            id="stock-threshold"
            type="number"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={t('thresholdPlaceholder')}
            disabled={!enabled}
          />
          <p className="text-sm text-muted-foreground">
            {t('thresholdDescription')}
          </p>
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('save')}
        </Button>
      </CardContent>
    </Card>
  )
}
