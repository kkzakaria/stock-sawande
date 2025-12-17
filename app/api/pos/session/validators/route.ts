import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/pos/session/validators
 * Returns list of managers/admins who can validate cash session discrepancies
 * Only returns users who have configured a PIN (checked server-side for security)
 * Accepts optional ?storeId= param for admins operating in different stores
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional storeId from query params
    const { searchParams } = new URL(request.url)
    const requestedStoreId = searchParams.get('storeId')

    // Get current user's profile
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('store_id, role')
      .eq('id', user.id)
      .single()

    if (!currentProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      )
    }

    const isAdmin = currentProfile.role === 'admin'

    // Determine which store to query validators for
    let storeId: string | null = null

    if (requestedStoreId) {
      // If storeId is provided, verify access
      if (isAdmin || currentProfile.store_id === requestedStoreId) {
        storeId = requestedStoreId
      } else {
        return NextResponse.json(
          { error: 'You do not have access to this store' },
          { status: 403 }
        )
      }
    } else {
      // No storeId provided - use assigned store
      if (!isAdmin && !currentProfile.store_id) {
        return NextResponse.json(
          { error: 'User not assigned to a store' },
          { status: 400 }
        )
      }
      storeId = currentProfile.store_id
    }

    // Use service role to bypass RLS and check PINs server-side
    // This is secure because we only return public info (name, role), not the PIN
    const { createClient: createServiceClient } = await import(
      '@supabase/supabase-js'
    )

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get managers from the store (if storeId is available)
    let storeManagers: { id: string; full_name: string | null; role: string }[] = []
    if (storeId) {
      const { data } = await serviceClient
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'manager')
        .eq('store_id', storeId)
        .neq('id', user.id) // Exclude current user
      storeManagers = data || []
    }

    // Get all admins
    const { data: admins } = await serviceClient
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'admin')
      .neq('id', user.id) // Exclude current user

    // Combine profiles
    const allProfiles = [...(storeManagers || []), ...(admins || [])]

    // Check which ones have PINs configured (server-side only)
    const validatorsWithPin: { id: string; full_name: string | null; role: string }[] = []

    for (const profile of allProfiles) {
      const { data: pinRecord } = await serviceClient
        .from('manager_pins')
        .select('id')
        .eq('user_id', profile.id)
        .single()

      if (pinRecord) {
        validatorsWithPin.push({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        })
      }
    }

    // Also return those without PIN for informational purposes
    const validatorsWithoutPin = allProfiles
      .filter((p) => !validatorsWithPin.find((v) => v.id === p.id))
      .map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: p.role,
      }))

    return NextResponse.json({
      validators: validatorsWithPin,
      validatorsWithoutPin,
    })
  } catch (error) {
    console.error('Error fetching validators:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
