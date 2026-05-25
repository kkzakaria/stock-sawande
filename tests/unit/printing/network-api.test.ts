import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client — returns a valid user by default.
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock node:net — we never open a real socket in tests.
vi.mock('node:net', () => {
  const mockSocket = {
    connect: vi.fn(),
    write: vi.fn((_data: unknown, cb: () => void) => cb()),
    end: vi.fn((_cb: () => void) => _cb()),
    on: vi.fn(),
    destroy: vi.fn(),
  }
  return { default: { createConnection: vi.fn(() => mockSocket) }, createConnection: vi.fn(() => mockSocket) }
})

import { createClient } from '@/lib/supabase/server'
import net from 'node:net'
import { POST } from '@/app/api/printing/tcp/route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/printing/tcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockAuthUser() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

function mockAuthAnon() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

describe('POST /api/printing/tcp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthAnon()
    const res = await POST(makeRequest({ host: '192.168.1.50', port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(401)
  })

  it('returns 422 when body is invalid (missing host)', async () => {
    mockAuthUser()
    const res = await POST(makeRequest({ port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(422)
  })

  it('returns 422 when port is out of range', async () => {
    mockAuthUser()
    const res = await POST(makeRequest({ host: '192.168.1.50', port: 99999, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(422)
  })

  it('returns 403 when host is a public IP (SSRF guard)', async () => {
    mockAuthUser()
    const res = await POST(makeRequest({ host: '8.8.8.8', port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/not allowed/i)
  })

  it('returns 403 for loopback address', async () => {
    mockAuthUser()
    const res = await POST(makeRequest({ host: '127.0.0.1', port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for another public IP', async () => {
    mockAuthUser()
    const res = await POST(makeRequest({ host: '1.2.3.4', port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(403)
  })

  it('accepts 192.168.x.x IPs and calls node:net', async () => {
    mockAuthUser()
    const mockSocket = {
      connect: vi.fn(),
      write: vi.fn((_data: unknown, cb: () => void) => cb()),
      end: vi.fn((_cb?: () => void) => { _cb?.() }),
      on: vi.fn(),
      destroy: vi.fn(),
    }
    vi.mocked(net.createConnection).mockImplementation(
      (_opts: unknown, cb: (() => void) | undefined) => {
        // Defer cb to a microtask so `socket` is assigned before the callback fires.
        if (cb) Promise.resolve().then(cb)
        return mockSocket as unknown as ReturnType<typeof net.createConnection>
      }
    )
    const res = await POST(makeRequest({ host: '192.168.1.50', port: 9100, timeoutMs: 5000, payload: 'SGVsbG8=' }))
    expect(res.status).toBe(200)
    expect(net.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ host: '192.168.1.50', port: 9100 }),
      expect.any(Function),
    )
  })

  it('accepts 10.x.x.x IPs', async () => {
    mockAuthUser()
    const mockSocket = {
      connect: vi.fn(),
      write: vi.fn((_data: unknown, cb: () => void) => cb()),
      end: vi.fn((_cb?: () => void) => { _cb?.() }),
      on: vi.fn(),
      destroy: vi.fn(),
    }
    vi.mocked(net.createConnection).mockImplementation(
      (_opts: unknown, cb: (() => void) | undefined) => {
        if (cb) Promise.resolve().then(cb)
        return mockSocket as unknown as ReturnType<typeof net.createConnection>
      }
    )
    const res = await POST(makeRequest({ host: '10.0.0.5', port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(200)
  })

  it('accepts 172.16.x.x IPs', async () => {
    mockAuthUser()
    const mockSocket = {
      connect: vi.fn(),
      write: vi.fn((_data: unknown, cb: () => void) => cb()),
      end: vi.fn((_cb?: () => void) => { _cb?.() }),
      on: vi.fn(),
      destroy: vi.fn(),
    }
    vi.mocked(net.createConnection).mockImplementation(
      (_opts: unknown, cb: (() => void) | undefined) => {
        if (cb) Promise.resolve().then(cb)
        return mockSocket as unknown as ReturnType<typeof net.createConnection>
      }
    )
    const res = await POST(makeRequest({ host: '172.16.0.1', port: 9100, timeoutMs: 5000, payload: 'AA==' }))
    expect(res.status).toBe(200)
  })
})
