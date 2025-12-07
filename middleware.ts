import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Force Edge Runtime for Cloudflare Workers compatibility
export const runtime = 'experimental-edge';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Generate Content Security Policy header with nonce
 * Follows Next.js 16 security recommendations
 */
function generateCSPHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  // Supabase URL that needs to be allowed
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const directives = [
    // Default fallback for all resource types
    "default-src 'self'",

    // Scripts: allow self, nonce-based scripts, and strict-dynamic for trusted scripts
    // In development, allow unsafe-eval for hot reloading
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''}`,

    // Styles: allow self and inline styles (needed for many UI libraries)
    // In production, prefer nonce-based styles
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}' 'unsafe-inline'`}`,

    // Images: allow self, data URIs, blob URIs, and Supabase storage
    `img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com`,

    // Fonts: allow self and Google Fonts
    "font-src 'self' https://fonts.gstatic.com",

    // Connect: allow self and Supabase APIs
    // In development, allow the full Supabase URL (http for local)
    `connect-src 'self' ${supabaseUrl || ''} https://*.supabase.co wss://*.supabase.co ${isDev ? 'http://localhost:* http://127.0.0.1:*' : ''}`,

    // Media: allow self
    "media-src 'self'",

    // Object: disallow plugins (Flash, etc.)
    "object-src 'none'",

    // Base URI: restrict to self
    "base-uri 'self'",

    // Form submissions: restrict to self
    "form-action 'self'",

    // Frame ancestors: prevent clickjacking
    "frame-ancestors 'none'",

    // Upgrade insecure requests in production
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ];

  return directives.join('; ');
}

/**
 * Set security headers on the response
 * Following OWASP and Next.js 16 security best practices
 */
function setSecurityHeaders(response: NextResponse, nonce: string): void {
  // Content Security Policy
  const cspHeader = generateCSPHeader(nonce);
  response.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());

  // Expose nonce for use in Server Components
  response.headers.set('x-nonce', nonce);

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking (legacy, CSP frame-ancestors is preferred)
  response.headers.set('X-Frame-Options', 'DENY');

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // DNS prefetch control
  response.headers.set('X-DNS-Prefetch-Control', 'on');

  // Permissions Policy (formerly Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Strict Transport Security (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
}

/**
 * Middleware function for Next.js
 * Runs on Edge Runtime for Cloudflare Workers compatibility
 * Handles:
 * 1. Security headers (CSP, X-Frame-Options, etc.)
 * 2. Internationalization routing (locale detection and URL prefixing)
 * 3. Custom headers with URL information for server components
 * 4. Supabase session refresh
 */
export async function middleware(request: NextRequest) {
  // Generate nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Handle i18n routing
  const response = intlMiddleware(request);

  // Apply security headers
  setSecurityHeaders(response, nonce);

  // Add pathname and search params as custom headers
  response.headers.set('x-pathname', request.nextUrl.pathname);
  response.headers.set('x-search-params', request.nextUrl.searchParams.toString());

  // Refresh Supabase session
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

/**
 * Middleware matcher configuration
 * Following Next.js recommendations for optimal performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api, trpc routes (API endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (Vercel internals)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     * - sw.js (service worker)
     * - Static files with extensions
     *
     * Also exclude prefetch requests to optimize performance
     */
    {
      source: '/((?!api|trpc|_next/static|_next/image|_vercel|favicon.ico|sitemap.xml|robots.txt|sw.js|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
