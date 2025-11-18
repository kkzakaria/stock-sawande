/**
 * Utilities for secure redirect handling after authentication
 */

/**
 * Validates and sanitizes a redirect URL to prevent open redirect vulnerabilities
 *
 * Security rules:
 * - Only allows relative URLs (starting with /)
 * - Rejects absolute URLs to external domains
 * - Rejects dangerous protocols (javascript:, data:, etc.)
 * - Returns fallback if URL is invalid
 *
 * @param redirectUrl - The URL to validate
 * @param fallback - Fallback URL if validation fails (default: '/dashboard')
 * @returns A safe redirect URL
 */
export function getSafeRedirectUrl(
  redirectUrl: string | null | undefined,
  fallback: string = '/dashboard'
): string {
  // No redirect provided, use fallback
  if (!redirectUrl || typeof redirectUrl !== 'string') {
    return fallback;
  }

  // Remove whitespace
  const trimmed = redirectUrl.trim();

  // Empty string, use fallback
  if (!trimmed) {
    return fallback;
  }

  // Must start with / (relative URL)
  if (!trimmed.startsWith('/')) {
    console.warn('[Security] Blocked external redirect attempt:', trimmed);
    return fallback;
  }

  // Reject protocol-relative URLs (//example.com)
  if (trimmed.startsWith('//')) {
    console.warn('[Security] Blocked protocol-relative redirect:', trimmed);
    return fallback;
  }

  // Reject dangerous protocols in URL-encoded format
  const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = trimmed.toLowerCase();
  for (const protocol of dangerous) {
    if (lowerUrl.includes(protocol)) {
      console.warn('[Security] Blocked dangerous protocol in redirect:', trimmed);
      return fallback;
    }
  }

  // URL looks safe - it's relative and doesn't contain dangerous patterns
  return trimmed;
}

/**
 * Builds a login URL with a redirect parameter
 *
 * @param currentPath - The current path to redirect back to after login
 * @returns Login URL with redirect parameter
 */
export function buildLoginUrl(currentPath: string): string {
  // Validate the current path first
  const safePath = getSafeRedirectUrl(currentPath, '/dashboard');

  // Build login URL with redirect parameter
  const loginUrl = new URL('/login', 'http://localhost'); // Base doesn't matter for relative URLs
  loginUrl.searchParams.set('redirect', safePath);

  return loginUrl.pathname + loginUrl.search;
}

/**
 * Extracts the redirect URL from search parameters
 *
 * @param searchParams - Next.js searchParams object
 * @returns Safe redirect URL
 */
export function getRedirectFromParams(
  searchParams: { [key: string]: string | string[] | undefined } | undefined
): string {
  if (!searchParams) {
    return '/dashboard';
  }

  const redirect = searchParams.redirect;

  // Handle array case (multiple redirect params)
  if (Array.isArray(redirect)) {
    return getSafeRedirectUrl(redirect[0]);
  }

  return getSafeRedirectUrl(redirect);
}
