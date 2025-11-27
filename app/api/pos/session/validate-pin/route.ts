/**
 * PIN Validation API Route
 * POST: Validate a manager/admin's PIN for cash session approval
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

interface ValidatePinRequest {
  managerId: string
  pin: string
}

/**
 * POST /api/pos/session/validate-pin
 * Validate a manager's PIN for approving cash session discrepancies
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body: ValidatePinRequest = await request.json()
    const { managerId, pin } = body

    // Validate request
    if (!managerId) {
      return NextResponse.json(
        { error: 'Manager ID is required', valid: false },
        { status: 400 }
      )
    }

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required', valid: false },
        { status: 400 }
      )
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits', valid: false },
        { status: 400 }
      )
    }

    // Verify the manager/admin exists and has the right role
    const { data: managerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, store_id, full_name')
      .eq('id', managerId)
      .single()

    if (profileError || !managerProfile) {
      return NextResponse.json(
        { error: 'Manager not found', valid: false },
        { status: 404 }
      )
    }

    if (!['manager', 'admin'].includes(managerProfile.role)) {
      return NextResponse.json(
        { error: 'User is not a manager or admin', valid: false },
        { status: 403 }
      )
    }

    // Get the current user's profile to verify same store (unless admin)
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('store_id, role')
      .eq('id', user.id)
      .single()

    // Check store access - admin can approve any store, manager only their own
    if (
      managerProfile.role === 'manager' &&
      currentUserProfile?.store_id !== managerProfile.store_id
    ) {
      return NextResponse.json(
        { error: 'Manager is not from the same store', valid: false },
        { status: 403 }
      )
    }

    // Get the manager's PIN hash using service role to bypass RLS
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: pinRecord, error: pinError } = await serviceClient
      .from('manager_pins')
      .select('pin_hash')
      .eq('user_id', managerId)
      .single()

    if (pinError || !pinRecord) {
      return NextResponse.json(
        { error: 'Manager has not configured a PIN', valid: false },
        { status: 400 }
      )
    }

    // Verify the PIN
    const isValid = await bcrypt.compare(pin, pinRecord.pin_hash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid PIN', valid: false },
        { status: 401 }
      )
    }

    // PIN is valid
    return NextResponse.json({
      valid: true,
      manager: {
        id: managerProfile.id,
        name: managerProfile.full_name,
        role: managerProfile.role,
      },
    })
  } catch (error) {
    console.error('PIN validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', valid: false },
      { status: 500 }
    )
  }
}
