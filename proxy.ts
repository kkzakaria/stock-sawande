import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy function to add custom headers with URL information
 * This allows server components to access the current pathname and search params
 * Note: Next.js 16 renamed middleware to proxy
 */
export function proxy(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers)

  // Add pathname and search params as custom headers
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  requestHeaders.set('x-search-params', request.nextUrl.searchParams.toString())

  // Return response with modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Apply proxy to all dashboard routes
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
