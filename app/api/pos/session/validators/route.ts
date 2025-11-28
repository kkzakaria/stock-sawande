import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/pos/session/validators
 * Returns list of managers/admins who can validate cash session discrepancies
 * Only returns users who have configured a PIN (checked server-side for security)
 */
export async function GET(_request: NextRequest) {
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

    // Get current user's store
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('store_id')
      .eq('id', user.id)
      .single()

    if (!currentProfile?.store_id) {
      return NextResponse.json(
        { error: 'User not assigned to a store' },
        { status: 400 }
      )
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

    // Get managers from same store
    const { data: storeManagers } = await serviceClient
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'manager')
      .eq('store_id', currentProfile.store_id)
      .neq('id', user.id) // Exclude current user

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
