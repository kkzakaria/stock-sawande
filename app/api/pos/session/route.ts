/**
 * POS Cash Session API Route
 * GET: Get active session for current cashier
 * POST: Open a new cash session
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional storeId from query params
    const { searchParams } = new URL(request.url)
    const requestedStoreId = searchParams.get('storeId')

    // Get user's profile
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

    const isAdmin = profile.role === 'admin'

    // Determine which store to query
    let storeId: string | null = null

    if (requestedStoreId) {
      // If storeId is provided, verify access
      if (isAdmin || profile.store_id === requestedStoreId) {
        storeId = requestedStoreId
      } else {
        return NextResponse.json(
          { error: 'You do not have access to this store' },
          { status: 403 }
        )
      }
    } else {
      // No storeId provided - use assigned store for non-admins
      if (!isAdmin && !profile.store_id) {
        return NextResponse.json(
          { error: 'User not assigned to a store' },
          { status: 400 }
        )
      }
      storeId = profile.store_id
    }

    // Build query for active session
    let query = supabase
      .from('cash_sessions')
      .select('*')
      .eq('cashier_id', user.id)
      .in('status', ['open', 'locked'] as const)

    // Filter by store if specified (admins without storeId get any active session)
    if (storeId) {
      query = query.eq('store_id', storeId)
    }

    const { data: session, error } = await query.maybeSingle()

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

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      )
    }

    // Admins can open sessions in any store
    // Managers and cashiers can only open sessions in their assigned store
    const isAdmin = profile.role === 'admin'
    const hasStoreAccess = profile.store_id === body.storeId

    if (!isAdmin && !hasStoreAccess) {
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
