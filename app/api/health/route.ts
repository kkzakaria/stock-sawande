/**
 * Health Check Endpoint
 * Used by the network status hook to verify connectivity
 *
 * This endpoint makes a real network request to verify internet connectivity,
 * not just local server connectivity.
 */

import { NextResponse } from 'next/server'

// No-cache headers to prevent any caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export async function GET() {
  // In development, try to reach an external endpoint to verify real internet connectivity
  if (process.env.NODE_ENV === 'development') {
    try {
      // Try to reach a reliable external endpoint
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
    } catch {
      // If external request fails, we're offline
      return NextResponse.json(
        { status: 'offline', timestamp: new Date().toISOString() },
        { status: 503, headers: noCacheHeaders }
      )
    }
  }

  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: noCacheHeaders }
  )
}

export async function HEAD() {
  // In development, verify real internet connectivity
  if (process.env.NODE_ENV === 'development') {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)

      await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
    } catch {
      return new NextResponse(null, { status: 503, headers: noCacheHeaders })
    }
  }

  return new NextResponse(null, { status: 200, headers: noCacheHeaders })
}
