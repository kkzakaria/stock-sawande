import type { PrinterError } from '../types'

export async function printNetwork(
  bytes: Uint8Array,
  config: { host: string; port: number; timeoutMs: number },
): Promise<{ ok: true } | { ok: false; error: PrinterError }> {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const payload = btoa(binary)

  let response: Response
  try {
    response = await fetch('/api/printing/tcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: config.host,
        port: config.port,
        timeoutMs: config.timeoutMs,
        payload,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'transport-error',
        message: err instanceof Error ? err.message : 'Network request failed',
      },
    }
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body = await response.json()
      if (typeof body?.error === 'string') detail = body.error
    } catch {
      // Ignore parse failures; keep the HTTP status message.
    }
    return { ok: false, error: { kind: 'transport-error', message: detail } }
  }

  return { ok: true }
}
