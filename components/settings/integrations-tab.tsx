'use client'

import { EmailSettings } from './email-settings'
import { WhatsAppSettings } from './whatsapp-settings'

interface IntegrationsSettings {
  email: {
    enabled: boolean
    apiKey: string
    fromEmail: string
    fromName: string
  }
  whatsapp: {
    enabled: boolean
    phoneNumberId: string
    accessToken: string
    businessAccountId: string
    webhookVerifyToken: string
  }
}

interface IntegrationsTabProps {
  initialSettings?: IntegrationsSettings
}

const defaultSettings: IntegrationsSettings = {
  email: {
    enabled: false,
    apiKey: '',
    fromEmail: '',
    fromName: '',
  },
  whatsapp: {
    enabled: false,
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    webhookVerifyToken: '',
  },
}

export function IntegrationsTab({ initialSettings }: IntegrationsTabProps) {
  const settings = initialSettings || defaultSettings

  return (
    <div className="space-y-6">
      <EmailSettings initialData={settings.email} />
      <WhatsAppSettings initialData={settings.whatsapp} />
    </div>
  )
}
