/**
 * SSE Heartbeat Endpoint
 * Provides Server-Sent Events for ultra-fast offline detection (<500ms)
 *
 * Each heartbeat verifies actual internet connectivity by pinging Supabase.
 * The connection drops immediately when network is lost, allowing
 * instant detection on the client side.
 */

import { NextRequest } from 'next/server'

const HEARTBEAT_INTERVAL = 3000 // Send heartbeat every 3 seconds
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const dynamic = 'force-dynamic'

/**
 * Check real internet connectivity by pinging Supabase
 */
async function checkConnectivity(): Promise<boolean> {
  if (!SUPABASE_URL) return true

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500)

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { apikey: SUPABASE_ANON_KEY || '' },
    })

    clearTimeout(timeoutId)
    return response.status !== 0
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  // Check connectivity before establishing SSE connection
  const initialConnectivity = await checkConnectivity()
  if (!initialConnectivity) {
    return new Response(
      encoder.encode('event: offline\ndata: {"status":"offline"}\n\n'),
      {
        status: 503,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    )
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(encoder.encode('event: connected\ndata: {"status":"ok"}\n\n'))

      // Set up heartbeat interval with connectivity check
      const intervalId = setInterval(async () => {
        try {
          const isOnline = await checkConnectivity()

          if (isOnline) {
            controller.enqueue(
              encoder.encode(`event: heartbeat\ndata: {"timestamp":${Date.now()}}\n\n`)
            )
          } else {
            // Send offline event and close stream
            controller.enqueue(
              encoder.encode('event: offline\ndata: {"status":"offline"}\n\n')
            )
            clearInterval(intervalId)
            controller.close()
          }
        } catch {
          // Stream closed, clean up
          clearInterval(intervalId)
        }
      }, HEARTBEAT_INTERVAL)

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
