'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schemas
const taxSettingsSchema = z.object({
  rate: z.number().min(0, 'Rate must be positive').max(1, 'Rate cannot exceed 100%'),
  enabled: z.boolean(),
})

const currencySettingsSchema = z.object({
  code: z.string().length(3, 'Currency code must be 3 characters'),
  locale: z.string().min(2, 'Locale is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  fractionDigits: z.number().int().min(0).max(4).optional(),
})

const stockAlertSettingsSchema = z.object({
  defaultThreshold: z.number().int().min(0, 'Threshold must be non-negative'),
  enabled: z.boolean(),
})

type TaxSettings = z.infer<typeof taxSettingsSchema>
type CurrencySettings = z.infer<typeof currencySettingsSchema>
type StockAlertSettings = z.infer<typeof stockAlertSettingsSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

interface BusinessSettings {
  tax_rate: TaxSettings
  currency: CurrencySettings
  stock_alerts: StockAlertSettings
}

/**
 * Get all business settings
 */
export async function getBusinessSettings(): Promise<ActionResult<BusinessSettings>> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: settings, error } = await supabase
      .from('business_settings')
      .select('key, value')

    if (error) {
      console.error('Error fetching business settings:', error)
      return { success: false, error: 'Failed to fetch business settings' }
    }

    // Transform array to object
    const settingsMap: Record<string, unknown> = {}
    settings?.forEach((setting) => {
      settingsMap[setting.key] = setting.value
    })

    return {
      success: true,
      data: {
        tax_rate: (settingsMap.tax_rate as TaxSettings) || { rate: 0.0875, enabled: true },
        currency: (settingsMap.currency as CurrencySettings) || { code: 'XOF', locale: 'fr-FR', symbol: 'CFA', fractionDigits: 0 },
        stock_alerts: (settingsMap.stock_alerts as StockAlertSettings) || { defaultThreshold: 10, enabled: true },
      },
    }
  } catch (error) {
    console.error('Error fetching business settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get a specific business setting by key
 */
export async function getBusinessSetting(key: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: setting, error } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error) {
      console.error('Error fetching setting:', error)
      return { success: false, error: 'Failed to fetch setting' }
    }

    return { success: true, data: setting.value }
  } catch (error) {
    console.error('Error fetching setting:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update tax settings (admin only)
 */
export async function updateTaxSettings(data: TaxSettings): Promise<ActionResult> {
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
      return { success: false, error: 'Only admins can update tax settings' }
    }

    // Validate input
    const validated = taxSettingsSchema.parse(data)

    // Update setting
    const { error } = await supabase
      .from('business_settings')
      .update({
        value: validated,
        updated_by: user.id,
      })
      .eq('key', 'tax_rate')

    if (error) {
      console.error('Error updating tax settings:', error)
      return { success: false, error: 'Failed to update tax settings' }
    }

    revalidatePath('/settings')
    revalidatePath('/pos')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating tax settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update currency settings (admin only)
 */
export async function updateCurrencySettings(data: CurrencySettings): Promise<ActionResult> {
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
      return { success: false, error: 'Only admins can update currency settings' }
    }

    // Validate input
    const validated = currencySettingsSchema.parse(data)

    // Update setting
    const { error } = await supabase
      .from('business_settings')
      .update({
        value: validated,
        updated_by: user.id,
      })
      .eq('key', 'currency')

    if (error) {
      console.error('Error updating currency settings:', error)
      return { success: false, error: 'Failed to update currency settings' }
    }

    revalidatePath('/settings')
    revalidatePath('/pos')
    revalidatePath('/products')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating currency settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update stock alert settings (admin only)
 */
export async function updateStockAlertSettings(data: StockAlertSettings): Promise<ActionResult> {
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
      return { success: false, error: 'Only admins can update stock alert settings' }
    }

    // Validate input
    const validated = stockAlertSettingsSchema.parse(data)

    // Update setting
    const { error } = await supabase
      .from('business_settings')
      .update({
        value: validated,
        updated_by: user.id,
      })
      .eq('key', 'stock_alerts')

    if (error) {
      console.error('Error updating stock alert settings:', error)
      return { success: false, error: 'Failed to update stock alert settings' }
    }

    revalidatePath('/settings')
    revalidatePath('/dashboard')
    revalidatePath('/products')
    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating stock alert settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
