/**
 * POS Cash Session Unlock API Route
 * POST: Unlock a locked cash session
 * Requires PIN verification (own PIN or manager PIN)
 */

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

interface UnlockSessionRequest {
  sessionId: string
  pin: string
  validatorId?: string // UUID of manager if not the session owner
}

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

    const body: UnlockSessionRequest = await request.json()

    // Validate request
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    if (!body.pin) {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      )
    }

    // Get the session
    const { data: session, error: fetchError } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('status', 'locked' as const)
      .single()

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Session not found or not locked' },
        { status: 404 }
      )
    }

    // Get current user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      )
    }

    const isOwner = session.cashier_id === user.id
    const isManager = profile.role === 'manager' || profile.role === 'admin'

    // Use service client to access manager_pins (bypasses RLS)
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Determine who needs to validate
    let validatorId: string

    if (body.validatorId) {
      // Manager override mode
      if (!isManager && body.validatorId !== user.id) {
        // Non-manager trying to use someone else's validation
        return NextResponse.json(
          { error: 'Only managers can unlock other users\' sessions' },
          { status: 403 }
        )
      }

      // Verify the validator is a manager/admin
      const { data: validatorProfile, error: validatorError } = await supabase
        .from('profiles')
        .select('id, role, store_id')
        .eq('id', body.validatorId)
        .single()

      if (validatorError || !validatorProfile) {
        return NextResponse.json(
          { error: 'Validator not found' },
          { status: 404 }
        )
      }

      if (!['manager', 'admin'].includes(validatorProfile.role)) {
        return NextResponse.json(
          { error: 'Validator must be a manager or admin' },
          { status: 403 }
        )
      }

      // Verify validator is from same store (unless admin)
      if (
        validatorProfile.role === 'manager' &&
        validatorProfile.store_id !== profile.store_id
      ) {
        return NextResponse.json(
          { error: 'Manager must be from the same store' },
          { status: 403 }
        )
      }

      validatorId = body.validatorId
    } else {
      // Self-unlock mode - must be the session owner
      if (!isOwner) {
        return NextResponse.json(
          { error: 'You can only unlock your own sessions. Use manager override for other sessions.' },
          { status: 403 }
        )
      }
      validatorId = user.id
    }

    // Get and verify the PIN
    const { data: pinRecord, error: pinError } = await serviceClient
      .from('manager_pins')
      .select('pin_hash')
      .eq('user_id', validatorId)
      .single()

    if (pinError || !pinRecord) {
      return NextResponse.json(
        { error: 'PIN not configured for this user' },
        { status: 400 }
      )
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(body.pin, pinRecord.pin_hash)

    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      )
    }

    // Update session to open
    const { data: unlockedSession, error: updateError } = await supabase
      .from('cash_sessions')
      .update({
        status: 'open',
        locked_at: null,
        locked_by: null,
      })
      .eq('id', body.sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('Session unlock error:', updateError)
      return NextResponse.json(
        { error: 'Failed to unlock session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: unlockedSession,
    })
  } catch (error) {
    console.error('Session unlock error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
