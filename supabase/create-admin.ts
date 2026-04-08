/**
 * Create a single admin user.
 * Usage: pnpm tsx supabase/create-admin.ts
 *
 * For local dev it targets the local Supabase (127.0.0.1:9000).
 * For production, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? 'http://127.0.0.1:9000'
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'REDACTED_SUPABASE_LOCAL_KEY'

const ADMIN_EMAIL = 'admin@stock-sawande.com'
const ADMIN_PASSWORD = 'AdSawande26@'
const ADMIN_FULL_NAME = 'Administrateur'

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`🔧 Creating admin on ${SUPABASE_URL}`)

  // Check if user already exists
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users.find((u) => u.email === ADMIN_EMAIL)

  let userId: string

  if (existing) {
    console.log(`ℹ️  User ${ADMIN_EMAIL} already exists, updating password...`)
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    userId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_FULL_NAME },
    })
    if (error) throw error
    if (!data.user) throw new Error('No user returned')
    userId = data.user.id
    console.log(`✅ Created auth user: ${ADMIN_EMAIL}`)
  }

  // Upsert profile with admin role
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: 'admin',
      full_name: ADMIN_FULL_NAME,
      store_id: null,
    })
    .eq('id', userId)

  if (profileError) throw profileError

  console.log(`✅ Admin ready: ${ADMIN_EMAIL}`)
}

main().catch((err) => {
  console.error('❌ Failed:', err)
  process.exit(1)
})
