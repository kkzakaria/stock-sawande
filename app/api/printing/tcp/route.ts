import { NextResponse } from 'next/server'
import net from 'node:net'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  timeoutMs: z.number().int().min(1000).max(30000),
  payload: z.string().min(1),
})

/**
 * Returns true when the host is within a private IPv4 range.
 * Allowed ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
 * Loopback (127.x) and public IPs are blocked.
 */
function isPrivateIp(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false
  }
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function writeAndClose(
  socket: ReturnType<typeof net.createConnection>,
  bytes: Buffer,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  socket.write(bytes, (err) => {
    if (err) {
      socket.destroy()
      reject(err)
      return
    }
    socket.end(() => {
      resolve()
    })
  })
}

function sendBytes(
  host: string,
  port: number,
  timeoutMs: number,
  bytes: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs }, () => {
      writeAndClose(socket, bytes, resolve, reject)
    })
    socket.on('error', (err) => {
      socket.destroy()
      reject(err)
    })
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Connection timed out'))
    })
  })
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 })
  }

  const { host, port, timeoutMs, payload } = parsed.data

  if (!isPrivateIp(host)) {
    return NextResponse.json(
      { error: `Host ${host} is not allowed. Only private IP ranges are permitted.` },
      { status: 403 },
    )
  }

  const bytes = Buffer.from(payload, 'base64')

  try {
    await sendBytes(host, port, timeoutMs, bytes)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}
