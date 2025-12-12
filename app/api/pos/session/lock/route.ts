/**
 * POS Cash Session Lock API Route
 * POST: Lock an active cash session temporarily
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface LockSessionRequest {
  sessionId: string
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

    const body: LockSessionRequest = await request.json()

    // Validate request
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get the session and verify ownership
    const { data: session, error: fetchError } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('status', 'open')
      .single()

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Session not found or not open' },
        { status: 404 }
      )
    }

    // Verify user owns this session
    if (session.cashier_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only lock your own sessions' },
        { status: 403 }
      )
    }

    // Update session to locked
    const { data: lockedSession, error: updateError } = await supabase
      .from('cash_sessions')
      .update({
        status: 'locked' as const,
        locked_at: new Date().toISOString(),
        locked_by: user.id,
      })
      .eq('id', body.sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('Session lock error:', updateError)
      return NextResponse.json(
        { error: 'Failed to lock session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session: lockedSession,
    })
  } catch (error) {
    console.error('Session lock error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
