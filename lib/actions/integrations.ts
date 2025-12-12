'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string(),
  fromEmail: z.string().email().or(z.literal('')),
  fromName: z.string(),
})

const whatsappSettingsSchema = z.object({
  enabled: z.boolean(),
  phoneNumberId: z.string(),
  accessToken: z.string(),
  businessAccountId: z.string(),
  webhookVerifyToken: z.string(),
})

type EmailSettings = z.infer<typeof emailSettingsSchema>
type WhatsAppSettings = z.infer<typeof whatsappSettingsSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface IntegrationsSettings {
  email: EmailSettings
  whatsapp: WhatsAppSettings
}

const defaultEmailSettings: EmailSettings = {
  enabled: false,
  apiKey: '',
  fromEmail: '',
  fromName: '',
}

const defaultWhatsAppSettings: WhatsAppSettings = {
  enabled: false,
  phoneNumberId: '',
  accessToken: '',
  businessAccountId: '',
  webhookVerifyToken: '',
}

/**
 * Get integrations settings
 */
export async function getIntegrationsSettings(): Promise<ActionResult<IntegrationsSettings>> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can view integration settings' }
    }

    const { data: settings, error } = await supabase
      .from('business_settings')
      .select('key, value')
      .in('key', ['email_settings', 'whatsapp_settings'])

    if (error) {
      console.error('Error fetching integrations settings:', error)
      return { success: false, error: 'Failed to fetch integrations settings' }
    }

    // Transform array to object
    const settingsMap: Record<string, unknown> = {}
    settings?.forEach((setting) => {
      settingsMap[setting.key] = setting.value
    })

    return {
      success: true,
      data: {
        email: (settingsMap.email_settings as EmailSettings) || defaultEmailSettings,
        whatsapp: (settingsMap.whatsapp_settings as WhatsAppSettings) || defaultWhatsAppSettings,
      },
    }
  } catch (error) {
    console.error('Error fetching integrations settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update email settings (admin only)
 */
export async function updateEmailSettings(data: EmailSettings): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can update email settings' }
    }

    // Validate input
    const validated = emailSettingsSchema.parse(data)

    // Upsert setting (insert if not exists, update if exists)
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        key: 'email_settings',
        value: validated,
        description: 'Email integration settings (Resend)',
        updated_by: user.id,
      }, {
        onConflict: 'key',
      })

    if (error) {
      console.error('Error updating email settings:', error)
      return { success: false, error: 'Failed to update email settings' }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating email settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update WhatsApp settings (admin only)
 */
export async function updateWhatsAppSettings(data: WhatsAppSettings): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can update WhatsApp settings' }
    }

    // Validate input
    const validated = whatsappSettingsSchema.parse(data)

    // Upsert setting (insert if not exists, update if exists)
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        key: 'whatsapp_settings',
        value: validated,
        description: 'WhatsApp Business API settings',
        updated_by: user.id,
      }, {
        onConflict: 'key',
      })

    if (error) {
      console.error('Error updating WhatsApp settings:', error)
      return { success: false, error: 'Failed to update WhatsApp settings' }
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating WhatsApp settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Test email connection (Resend)
 */
export async function testEmailConnection(): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can test email connection' }
    }

    // Get email settings
    const { data: setting } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'email_settings')
      .single()

    if (!setting?.value) {
      return { success: false, error: 'Email settings not configured' }
    }

    const emailSettings = setting.value as EmailSettings

    if (!emailSettings.enabled || !emailSettings.apiKey) {
      return { success: false, error: 'Email not enabled or API key missing' }
    }

    // Test connection by calling Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailSettings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailSettings.fromEmail ? `${emailSettings.fromName} <${emailSettings.fromEmail}>` : 'onboarding@resend.dev',
        to: profile.email,
        subject: 'Test Email - Next Stock',
        html: '<p>This is a test email from Next Stock to verify your email configuration.</p>',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { success: false, error: errorData.message || 'Failed to send test email' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error testing email connection:', error)
    return { success: false, error: 'Failed to test email connection' }
  }
}

/**
 * Test WhatsApp connection
 */
export async function testWhatsAppConnection(): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can test WhatsApp connection' }
    }

    // Get WhatsApp settings
    const { data: setting } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'whatsapp_settings')
      .single()

    if (!setting?.value) {
      return { success: false, error: 'WhatsApp settings not configured' }
    }

    const whatsappSettings = setting.value as WhatsAppSettings

    if (!whatsappSettings.enabled || !whatsappSettings.accessToken) {
      return { success: false, error: 'WhatsApp not enabled or access token missing' }
    }

    // Test connection by fetching phone number info from WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappSettings.phoneNumberId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${whatsappSettings.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.error?.message || 'Failed to verify WhatsApp credentials'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error testing WhatsApp connection:', error)
    return { success: false, error: 'Failed to test WhatsApp connection' }
  }
}
