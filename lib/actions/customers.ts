'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Validation schema for customer
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type CustomerInput = z.infer<typeof customerSchema>

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Create a new customer (cashier and above)
 */
export async function createCustomer(data: CustomerInput): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user has permission (cashier and above can create)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager', 'cashier'].includes(profile.role)) {
      return { success: false, error: 'Insufficient permissions' }
    }

    // Validate input
    const validated = customerSchema.parse(data)

    // Create customer
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        name: validated.name,
        email: validated.email || null,
        phone: validated.phone || null,
        address: validated.address || null,
        notes: validated.notes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
      if (error.code === '23505') {
        return { success: false, error: 'A customer with this email already exists' }
      }
      return { success: false, error: 'Failed to create customer' }
    }

    revalidatePath('/customers')
    return { success: true, data: customer }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error creating customer:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Update an existing customer (manager and above)
 */
export async function updateCustomer(id: string, data: Partial<CustomerInput>): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user has permission (manager and above can update)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Only managers and admins can update customers' }
    }

    // Validate input
    const validated = customerSchema.partial().parse(data)

    // Update customer
    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        ...validated,
        email: validated.email || null,
        phone: validated.phone || null,
        address: validated.address || null,
        notes: validated.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer:', error)
      if (error.code === '23505') {
        return { success: false, error: 'A customer with this email already exists' }
      }
      return { success: false, error: 'Failed to update customer' }
    }

    revalidatePath('/customers')
    return { success: true, data: customer }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    console.error('Error updating customer:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a customer (manager and above)
 */
export async function deleteCustomer(id: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user has permission (manager and above can delete)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return { success: false, error: 'Only managers and admins can delete customers' }
    }

    // Check if customer has associated sales
    const { count: salesCount } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id)

    if (salesCount && salesCount > 0) {
      return {
        success: false,
        error: 'Cannot delete customer with existing sales. Consider updating customer information instead.'
      }
    }

    // Check if customer has associated proformas
    const { count: proformasCount } = await supabase
      .from('proformas')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id)

    if (proformasCount && proformasCount > 0) {
      return {
        success: false,
        error: 'Cannot delete customer with existing proformas. Consider updating customer information instead.'
      }
    }

    // Delete customer
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting customer:', error)
      return { success: false, error: 'Failed to delete customer' }
    }

    revalidatePath('/customers')
    return { success: true }
  } catch (error) {
    console.error('Error deleting customer:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
