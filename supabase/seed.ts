/**
 * Supabase User Seeding Script
 * Uses Admin API to properly create test users with hashed passwords
 * Run with: pnpm seed:users
 */

import { createClient } from '@supabase/supabase-js'

// Local Supabase instance
const SUPABASE_URL = 'http://127.0.0.1:9000'
const SUPABASE_SERVICE_ROLE_KEY = 'REDACTED_SUPABASE_LOCAL_KEY'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface TestUserConfig {
  email: string
  password: string
  role: 'admin' | 'manager' | 'cashier'
  store_name: string | null // Reference by name, not UUID
  full_name: string
}

interface TestUser {
  email: string
  password: string
  role: 'admin' | 'manager' | 'cashier'
  store_id: string | null
  full_name: string
}

// Define users with store names (will be resolved to IDs at runtime)
const testUserConfigs: TestUserConfig[] = [
  {
    email: 'admin@test.nextstock.com',
    password: 'password123',
    role: 'admin',
    store_name: null,
    full_name: 'Admin User',
  },
  {
    email: 'manager1@test.nextstock.com',
    password: 'password123',
    role: 'manager',
    store_name: 'Downtown Store',
    full_name: 'Manager Downtown',
  },
  {
    email: 'manager2@test.nextstock.com',
    password: 'password123',
    role: 'manager',
    store_name: 'Uptown Store',
    full_name: 'Manager Uptown',
  },
  {
    email: 'cashier1@test.nextstock.com',
    password: 'password123',
    role: 'cashier',
    store_name: 'Downtown Store',
    full_name: 'Cashier Downtown',
  },
  {
    email: 'cashier2@test.nextstock.com',
    password: 'password123',
    role: 'cashier',
    store_name: 'Uptown Store',
    full_name: 'Cashier Uptown',
  },
  {
    email: 'cashier3@test.nextstock.com',
    password: 'password123',
    role: 'cashier',
    store_name: 'Brooklyn Store',
    full_name: 'Cashier Brooklyn',
  },
]

// Store name to ID mapping (populated at runtime)
let storeMap: Map<string, string> = new Map()

async function fetchStoreIds() {
  console.log('🏪 Fetching store IDs from database...')

  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, name')

  if (error) {
    throw new Error(`Failed to fetch stores: ${error.message}`)
  }

  if (!stores || stores.length === 0) {
    throw new Error('No stores found in database. Run seed.sql first.')
  }

  storeMap = new Map(stores.map((s) => [s.name, s.id]))
  console.log(`✅ Found ${stores.length} store(s): ${stores.map((s) => s.name).join(', ')}`)
}

function resolveTestUsers(): TestUser[] {
  return testUserConfigs.map((config) => ({
    email: config.email,
    password: config.password,
    role: config.role,
    store_id: config.store_name ? storeMap.get(config.store_name) ?? null : null,
    full_name: config.full_name,
  }))
}

async function deleteExistingTestUsers() {
  console.log('🗑️  Deleting existing test users...')

  // Get all test users
  const { data: users } = await supabase.auth.admin.listUsers()

  if (!users?.users) {
    console.log('No users to delete')
    return
  }

  // Delete test users (those with @test.nextstock.com email)
  const testUserIds = users.users
    .filter((u) => u.email?.endsWith('@test.nextstock.com'))
    .map((u) => u.id)

  for (const userId of testUserIds) {
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) {
      console.error(`Error deleting user ${userId}:`, error.message)
    }
  }

  console.log(`✅ Deleted ${testUserIds.length} test user(s)`)
}

async function createTestUsers() {
  console.log('👥 Creating test users...')

  const testUsers = resolveTestUsers()

  for (const user of testUsers) {
    try {
      // Create user with Admin API (handles bcrypt hashing automatically)
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Skip email verification for test users
        user_metadata: {
          full_name: user.full_name,
        },
      })

      if (error) {
        console.error(`❌ Error creating ${user.email}:`, error.message)
        continue
      }

      if (!data.user) {
        console.error(`❌ No user data returned for ${user.email}`)
        continue
      }

      console.log(`✅ Created user: ${user.email}`)

      // Update profile with correct role and store_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: user.role,
          store_id: user.store_id,
          full_name: user.full_name,
        })
        .eq('id', data.user.id)

      if (profileError) {
        console.error(`❌ Error updating profile for ${user.email}:`, profileError.message)
      } else {
        console.log(`   ✓ Updated profile: role=${user.role}`)
      }
    } catch (err) {
      console.error(`❌ Unexpected error for ${user.email}:`, err)
    }
  }
}

async function main() {
  console.log('\n🌱 Starting user seeding process...\n')

  try {
    // Step 1: Fetch store IDs from database
    await fetchStoreIds()

    console.log('')

    // Step 2: Delete existing test users
    await deleteExistingTestUsers()

    console.log('')

    // Step 3: Create new test users with resolved store IDs
    await createTestUsers()

    console.log('\n✅ User seeding completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

main()
