/**
 * POS Cash Session API Route
 * GET: Get active session for current cashier
 * POST: Open a new cash session
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's store
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_id')
      .eq('id', user.id)
      .single()

    if (!profile?.store_id) {
      return NextResponse.json(
        { error: 'User not assigned to a store' },
        { status: 400 }
      )
    }

    // Get active session for this cashier (open or locked)
    const { data: session, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('store_id', profile.store_id)
      .eq('cashier_id', user.id)
      .in('status', ['open', 'locked'] as const)
      .maybeSingle()

    if (error) {
      console.error('Session fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Session GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface OpenSessionRequest {
  storeId: string
  openingAmount: number
  notes?: string
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

    const body: OpenSessionRequest = await request.json()

    // Validate request
    if (!body.storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    if (body.openingAmount < 0) {
      return NextResponse.json(
        { error: 'Opening amount cannot be negative' },
        { status: 400 }
      )
    }

    // Verify user has permission
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_id, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.store_id !== body.storeId) {
      return NextResponse.json(
        { error: 'You are not authorized to open sessions for this store' },
        { status: 403 }
      )
    }

    // Check if there's already an active session for this cashier (open or locked)
    const { data: existingSession } = await supabase
      .from('cash_sessions')
      .select('id, status')
      .eq('store_id', body.storeId)
      .eq('cashier_id', user.id)
      .in('status', ['open', 'locked'] as const)
      .maybeSingle()

    if (existingSession) {
      const message = (existingSession.status as string) === 'locked'
        ? 'You have a locked session. Please unlock it first.'
        : 'You already have an open session'
      return NextResponse.json(
        { error: message },
        { status: 400 }
      )
    }

    // Create new session
    const { data: session, error: createError } = await supabase
      .from('cash_sessions')
      .insert({
        store_id: body.storeId,
        cashier_id: user.id,
        opening_amount: body.openingAmount,
        opening_notes: body.notes || null,
        status: 'open',
      })
      .select()
      .single()

    if (createError) {
      console.error('Session creation error:', createError)
      return NextResponse.json(
        { error: 'Failed to open session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error('Session POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
