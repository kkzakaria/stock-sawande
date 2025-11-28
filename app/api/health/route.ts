/**
 * Health Check Endpoint
 * Used by the network status hook to verify connectivity
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
