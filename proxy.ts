import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Proxy function for Next.js 16
 * Handles:
 * 1. Internationalization routing (locale detection and URL prefixing)
 * 2. Custom headers with URL information for server components
 * 3. Supabase session refresh
 */
export async function proxy(request: NextRequest) {
  // First, handle i18n routing
  const response = intlMiddleware(request);

  // Add pathname and search params as custom headers
  response.headers.set('x-pathname', request.nextUrl.pathname);
  response.headers.set('x-search-params', request.nextUrl.searchParams.toString());

  // Then, refresh Supabase session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

// Apply proxy to all routes except static files and API routes
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api, trpc routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (Vercel internals)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Static files with extensions
     */
    '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
  ],
};
