/**
 * PIN Management API Route
 * GET: Check if current user has a PIN configured
 * POST: Create or update the user's PIN
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * GET /api/settings/pin
 * Returns whether the current user has a PIN configured
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is manager or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only managers and admins can have a PIN' },
        { status: 403 }
      )
    }

    // Check if user has a PIN
    const { data: pinRecord } = await supabase
      .from('manager_pins')
      .select('id, created_at, updated_at')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      hasPin: !!pinRecord,
      createdAt: pinRecord?.created_at || null,
      updatedAt: pinRecord?.updated_at || null,
    })
  } catch (error) {
    console.error('PIN check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/pin
 * Create or update the user's PIN
 * Body: { pin: string } - 6 digit PIN
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

    // Check if user is manager or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['manager', 'admin'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only managers and admins can set a PIN' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      )
    }

    // Validate PIN format: exactly 6 digits
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits' },
        { status: 400 }
      )
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS)

    // Check if user already has a PIN
    const { data: existingPin } = await supabase
      .from('manager_pins')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingPin) {
      // Update existing PIN
      const { error: updateError } = await supabase
        .from('manager_pins')
        .update({ pin_hash: pinHash })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('PIN update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update PIN' },
          { status: 500 }
        )
      }
    } else {
      // Create new PIN
      const { error: insertError } = await supabase
        .from('manager_pins')
        .insert({
          user_id: user.id,
          pin_hash: pinHash,
        })

      if (insertError) {
        console.error('PIN insert error:', insertError)
        return NextResponse.json(
          { error: 'Failed to create PIN' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: existingPin ? 'PIN updated successfully' : 'PIN created successfully',
    })
  } catch (error) {
    console.error('PIN creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/pin
 * Remove the user's PIN
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the PIN
    const { error: deleteError } = await supabase
      .from('manager_pins')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('PIN delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete PIN' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'PIN deleted successfully',
    })
  } catch (error) {
    console.error('PIN deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
