/**
 * Health Check Endpoint
 * Used by the network status hook to verify connectivity
 *
 * Verifies actual internet connectivity by pinging Supabase,
 * which is the critical dependency for the POS system.
 */

import { NextResponse } from 'next/server'

// No-cache headers to prevent any caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

// Supabase project URL for connectivity check
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

/**
 * Check real internet connectivity by pinging Supabase
 * This is more reliable than checking localhost
 */
async function checkInternetConnectivity(): Promise<boolean> {
  if (!SUPABASE_URL) {
    // No Supabase URL configured, assume online
    return true
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500)

    // Ping Supabase REST endpoint (returns 401 without auth, but that's fine)
    // We just need to verify network connectivity
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        // Minimal headers to avoid CORS issues
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    })

    clearTimeout(timeoutId)

    // Any response (even 401/403) means we have connectivity
    // Only network errors should indicate offline status
    return response.status !== 0
  } catch {
    // Network error, DNS failure, or timeout = offline
    return false
  }
}

export async function GET() {
  const isOnline = await checkInternetConnectivity()

  if (!isOnline) {
    return NextResponse.json(
      { status: 'offline', timestamp: new Date().toISOString() },
      { status: 503, headers: noCacheHeaders }
    )
  }

  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: noCacheHeaders }
  )
}

export async function HEAD() {
  const isOnline = await checkInternetConnectivity()

  if (!isOnline) {
    return new NextResponse(null, { status: 503, headers: noCacheHeaders })
  }

  return new NextResponse(null, { status: 200, headers: noCacheHeaders })
}
