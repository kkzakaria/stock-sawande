import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createUserSchema } from './schema'

export async function POST(request: Request) {
  try {
    // 1. Verify requesting user is authenticated and is admin
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can create users' },
        { status: 403 }
      )
    }

    // 2. Validate input
    const body = await request.json()
    const validated = createUserSchema.parse(body)

    // 3. Create user with admin client (service role)
    const adminClient = createAdminClient()

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true, // Skip email verification
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { success: false, error: 'A user with this email already exists' },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 })
    }

    const newUserId = authData.user.id

    // 4. Update the auto-created profile with role and full_name
    // (Profile is created by database trigger with default role='cashier')
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        role: validated.role,
        full_name: validated.full_name || null,
      })
      .eq('id', newUserId)

    if (profileError) {
      console.error('Profile update error:', profileError)
      await adminClient.auth.admin.deleteUser(newUserId).catch((err) => console.error('CRITICAL: rollback deleteUser failed, orphaned auth user:', newUserId, err))
      return NextResponse.json(
        { success: false, error: 'Failed to set user profile; rolled back' },
        { status: 500 }
      )
    }

    // 5. Create store assignments if provided
    if (validated.store_ids && validated.store_ids.length > 0) {
      const assignments = validated.store_ids.map((storeId) => ({
        user_id: newUserId,
        store_id: storeId,
        is_default: storeId === validated.default_store_id,
      }))

      const { error: storesError } = await adminClient.from('user_stores').insert(assignments)

      if (storesError) {
        console.error('Store assignment error:', storesError)
        await adminClient.auth.admin.deleteUser(newUserId).catch((err) => console.error('CRITICAL: rollback deleteUser failed, orphaned auth user:', newUserId, err))
        return NextResponse.json(
          { success: false, error: 'Failed to assign stores; rolled back' },
          { status: 500 }
        )
      }

      // Update profile's store_id to default store
      if (validated.default_store_id) {
        const { error: defaultStoreError } = await adminClient
          .from('profiles')
          .update({ store_id: validated.default_store_id })
          .eq('id', newUserId)

        if (defaultStoreError) {
          console.error('Failed to set default store (non-fatal):', defaultStoreError)
        }
      }
    }

    // 6. Fetch complete user data to return
    const { data: newUser } = await adminClient
      .from('profiles')
      .select(
        `
        *,
        user_stores (
          id,
          store_id,
          is_default,
          stores (id, name)
        )
      `
      )
      .eq('id', newUserId)
      .single()

    return NextResponse.json({
      success: true,
      data: newUser,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400 })
    }
    console.error('Create user error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
