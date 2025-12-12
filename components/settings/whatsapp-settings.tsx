'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2, MessageCircle, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { updateWhatsAppSettings, testWhatsAppConnection } from '@/lib/actions/integrations'

interface WhatsAppSettingsProps {
  initialData: {
    enabled: boolean
    phoneNumberId: string
    accessToken: string
    businessAccountId: string
    webhookVerifyToken: string
  }
}

export function WhatsAppSettings({ initialData }: WhatsAppSettingsProps) {
  const t = useTranslations('Settings.integrations.whatsapp')
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTestTransition] = useTransition()
  const [showToken, setShowToken] = useState(false)
  const [enabled, setEnabled] = useState(initialData.enabled)
  const [phoneNumberId, setPhoneNumberId] = useState(initialData.phoneNumberId)
  const [accessToken, setAccessToken] = useState(initialData.accessToken)
  const [businessAccountId, setBusinessAccountId] = useState(initialData.businessAccountId)
  const [webhookVerifyToken, setWebhookVerifyToken] = useState(initialData.webhookVerifyToken)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleSave = () => {
    setError(null)
    setTestResult(null)

    if (enabled && !phoneNumberId) {
      setError(t('errors.phoneNumberIdRequired'))
      return
    }

    if (enabled && !accessToken) {
      setError(t('errors.accessTokenRequired'))
      return
    }

    startTransition(async () => {
      const result = await updateWhatsAppSettings({
        enabled,
        phoneNumberId,
        accessToken,
        businessAccountId,
        webhookVerifyToken,
      })

      if (result.success) {
        toast.success(t('success'))
      } else {
        setError(result.error || t('error'))
      }
    })
  }

  const handleTestConnection = () => {
    setTestResult(null)
    startTestTransition(async () => {
      const result = await testWhatsAppConnection()
      if (result.success) {
        setTestResult('success')
        toast.success(t('testSuccess'))
      } else {
        setTestResult('error')
        toast.error(result.error || t('testError'))
      }
    })
  }

  // Mask token for display
  const maskedToken = accessToken ? accessToken.slice(0, 10) + '••••••••••••••••' : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
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
          <Label htmlFor="whatsapp-enabled">{t('enabled')}</Label>
          <Switch
            id="whatsapp-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone-number-id">{t('phoneNumberId')}</Label>
          <Input
            id="phone-number-id"
            type="text"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="1234567890123456"
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            {t('phoneNumberIdHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="access-token">{t('accessToken')}</Label>
          <div className="relative">
            <Input
              id="access-token"
              type={showToken ? 'text' : 'password'}
              value={showToken ? accessToken : maskedToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAAxxxxxxxxx..."
              disabled={!enabled}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowToken(!showToken)}
              disabled={!enabled}
            >
              {showToken ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('accessTokenHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-account-id">{t('businessAccountId')}</Label>
          <Input
            id="business-account-id"
            type="text"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="1234567890123456"
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            {t('businessAccountIdHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webhook-verify-token">{t('webhookVerifyToken')}</Label>
          <Input
            id="webhook-verify-token"
            type="text"
            value={webhookVerifyToken}
            onChange={(e) => setWebhookVerifyToken(e.target.value)}
            placeholder="your-verify-token"
            disabled={!enabled}
          />
          <p className="text-xs text-muted-foreground">
            {t('webhookVerifyTokenHelp')}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('save')}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!enabled || !accessToken || !phoneNumberId || isTesting}
          >
            {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {testResult === 'success' && <CheckCircle className="h-4 w-4 mr-2 text-green-600" />}
            {testResult === 'error' && <XCircle className="h-4 w-4 mr-2 text-red-600" />}
            {t('testConnection')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
