import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Refresh the Supabase session on every request so the server-side client
 * always has a valid access token.  Updates BOTH request cookies (so the
 * current route handler sees the fresh token) and response cookies (so the
 * browser stores it for the next request).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Update request cookies so the current route handler gets the
            // refreshed access token rather than the (possibly expired) original.
            request.cookies.set(name, value)
            // Update response cookies so the browser stores the fresh token.
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // Calling getUser() triggers an automatic token refresh when the access
    // token is expired but the refresh token is still valid.
    await supabase.auth.getUser()
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static assets.
     * Include API routes so checkout and sync endpoints always have a
     * valid session available via cookies().
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
