'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Loader2, Mail, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { updateEmailSettings, testEmailConnection } from '@/lib/actions/integrations'

interface EmailSettingsProps {
  initialData: {
    enabled: boolean
    apiKey: string
    fromEmail: string
    fromName: string
  }
}

export function EmailSettings({ initialData }: EmailSettingsProps) {
  const t = useTranslations('Settings.integrations.email')
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTestTransition] = useTransition()
  const [showApiKey, setShowApiKey] = useState(false)
  const [enabled, setEnabled] = useState(initialData.enabled)
  const [apiKey, setApiKey] = useState(initialData.apiKey)
  const [fromEmail, setFromEmail] = useState(initialData.fromEmail)
  const [fromName, setFromName] = useState(initialData.fromName)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleSave = () => {
    setError(null)
    setTestResult(null)

    if (enabled && !apiKey) {
      setError(t('errors.apiKeyRequired'))
      return
    }

    if (enabled && !fromEmail) {
      setError(t('errors.fromEmailRequired'))
      return
    }

    startTransition(async () => {
      const result = await updateEmailSettings({
        enabled,
        apiKey,
        fromEmail,
        fromName,
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
      const result = await testEmailConnection()
      if (result.success) {
        setTestResult('success')
        toast.success(t('testSuccess'))
      } else {
        setTestResult('error')
        toast.error(result.error || t('testError'))
      }
    })
  }

  // Mask API key for display
  const maskedApiKey = apiKey ? apiKey.slice(0, 8) + '••••••••••••••••' : ''

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
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
          <Label htmlFor="email-enabled">{t('enabled')}</Label>
          <Switch
            id="email-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="resend-api-key">{t('apiKey')}</Label>
          <div className="relative">
            <Input
              id="resend-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={showApiKey ? apiKey : maskedApiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxx"
              disabled={!enabled}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowApiKey(!showApiKey)}
              disabled={!enabled}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('apiKeyHelp')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-email">{t('fromEmail')}</Label>
          <Input
            id="from-email"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="noreply@example.com"
            disabled={!enabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-name">{t('fromName')}</Label>
          <Input
            id="from-name"
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Next Stock"
            disabled={!enabled}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('save')}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!enabled || !apiKey || isTesting}
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
