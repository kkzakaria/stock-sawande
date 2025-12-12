'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  encrypt,
  decrypt,
  isEncrypted,
  type EncryptedData,
} from '@/lib/encryption'
import type { Json } from '@/types/database.types'

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

// Types for encrypted storage - must be JSON serializable
interface EncryptedEmailSettings {
  enabled: boolean
  apiKey: EncryptedData | string
  fromEmail: string
  fromName: string
  [key: string]: unknown // Index signature for Json compatibility
}

interface EncryptedWhatsAppSettings {
  enabled: boolean
  phoneNumberId: string
  accessToken: EncryptedData | string
  businessAccountId: string
  webhookVerifyToken: EncryptedData | string
  [key: string]: unknown // Index signature for Json compatibility
}

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
 * Decrypt email settings from database format
 */
function decryptEmailSettings(stored: EncryptedEmailSettings): EmailSettings {
  return {
    enabled: stored.enabled,
    apiKey: isEncrypted(stored.apiKey) ? decrypt(stored.apiKey) : (stored.apiKey || ''),
    fromEmail: stored.fromEmail || '',
    fromName: stored.fromName || '',
  }
}

/**
 * Encrypt email settings for storage
 */
function encryptEmailSettings(settings: EmailSettings): EncryptedEmailSettings {
  return {
    enabled: settings.enabled,
    apiKey: settings.apiKey ? encrypt(settings.apiKey) : '',
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
  }
}

/**
 * Decrypt WhatsApp settings from database format
 */
function decryptWhatsAppSettings(stored: EncryptedWhatsAppSettings): WhatsAppSettings {
  return {
    enabled: stored.enabled,
    phoneNumberId: stored.phoneNumberId || '',
    accessToken: isEncrypted(stored.accessToken) ? decrypt(stored.accessToken) : (stored.accessToken || ''),
    businessAccountId: stored.businessAccountId || '',
    webhookVerifyToken: isEncrypted(stored.webhookVerifyToken) ? decrypt(stored.webhookVerifyToken) : (stored.webhookVerifyToken || ''),
  }
}

/**
 * Encrypt WhatsApp settings for storage
 */
function encryptWhatsAppSettings(settings: WhatsAppSettings): EncryptedWhatsAppSettings {
  return {
    enabled: settings.enabled,
    phoneNumberId: settings.phoneNumberId,
    accessToken: settings.accessToken ? encrypt(settings.accessToken) : '',
    businessAccountId: settings.businessAccountId,
    webhookVerifyToken: settings.webhookVerifyToken ? encrypt(settings.webhookVerifyToken) : '',
  }
}

/**
 * Get integrations settings (decrypted)
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

    // Decrypt settings before returning
    let emailSettings = defaultEmailSettings
    let whatsappSettings = defaultWhatsAppSettings

    if (settingsMap.email_settings) {
      try {
        emailSettings = decryptEmailSettings(settingsMap.email_settings as EncryptedEmailSettings)
      } catch (e) {
        console.error('Error decrypting email settings:', e)
        // Return default if decryption fails (e.g., key changed)
      }
    }

    if (settingsMap.whatsapp_settings) {
      try {
        whatsappSettings = decryptWhatsAppSettings(settingsMap.whatsapp_settings as EncryptedWhatsAppSettings)
      } catch (e) {
        console.error('Error decrypting WhatsApp settings:', e)
        // Return default if decryption fails
      }
    }

    return {
      success: true,
      data: {
        email: emailSettings,
        whatsapp: whatsappSettings,
      },
    }
  } catch (error) {
    console.error('Error fetching integrations settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update email settings (admin only) - encrypts sensitive fields
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

    // Encrypt sensitive fields before storage
    const encryptedSettings = encryptEmailSettings(validated)

    // Upsert setting (insert if not exists, update if exists)
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        key: 'email_settings',
        value: encryptedSettings as unknown as Json,
        description: 'Email integration settings (Resend) - API key encrypted',
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
 * Update WhatsApp settings (admin only) - encrypts sensitive fields
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

    // Encrypt sensitive fields before storage
    const encryptedSettings = encryptWhatsAppSettings(validated)

    // Upsert setting (insert if not exists, update if exists)
    const { error } = await supabase
      .from('business_settings')
      .upsert({
        key: 'whatsapp_settings',
        value: encryptedSettings as unknown as Json,
        description: 'WhatsApp Business API settings - tokens encrypted',
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
 * Test email connection (Resend) - uses decrypted API key
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

    // Decrypt settings
    const encryptedSettings = setting.value as unknown as EncryptedEmailSettings
    const emailSettings = decryptEmailSettings(encryptedSettings)

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
 * Test WhatsApp connection - uses decrypted access token
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

    // Decrypt settings
    const encryptedSettings = setting.value as unknown as EncryptedWhatsAppSettings
    const whatsappSettings = decryptWhatsAppSettings(encryptedSettings)

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

/**
 * Get decrypted email API key for internal use (e.g., sending emails)
 * This should only be called from server-side code
 */
export async function getEmailApiKey(): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data: setting } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'email_settings')
      .single()

    if (!setting?.value) {
      return null
    }

    const encryptedSettings = setting.value as unknown as EncryptedEmailSettings

    if (!encryptedSettings.enabled) {
      return null
    }

    const emailSettings = decryptEmailSettings(encryptedSettings)
    return emailSettings.apiKey || null
  } catch (error) {
    console.error('Error getting email API key:', error)
    return null
  }
}

/**
 * Get decrypted WhatsApp access token for internal use
 * This should only be called from server-side code
 */
export async function getWhatsAppCredentials(): Promise<{
  accessToken: string
  phoneNumberId: string
  businessAccountId: string
} | null> {
  try {
    const supabase = await createClient()

    const { data: setting } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'whatsapp_settings')
      .single()

    if (!setting?.value) {
      return null
    }

    const encryptedSettings = setting.value as unknown as EncryptedWhatsAppSettings

    if (!encryptedSettings.enabled) {
      return null
    }

    const whatsappSettings = decryptWhatsAppSettings(encryptedSettings)

    if (!whatsappSettings.accessToken) {
      return null
    }

    return {
      accessToken: whatsappSettings.accessToken,
      phoneNumberId: whatsappSettings.phoneNumberId,
      businessAccountId: whatsappSettings.businessAccountId,
    }
  } catch (error) {
    console.error('Error getting WhatsApp credentials:', error)
    return null
  }
}
