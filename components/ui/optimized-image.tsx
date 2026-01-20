'use client'

import Image, { ImageProps } from 'next/image'

/**
 * Check if URL points to a local/private address
 */
function isLocalUrl(src: string | undefined | null): boolean {
  if (!src || typeof src !== 'string') return false

  try {
    const url = new URL(src)
    const hostname = url.hostname

    // Check for localhost, 127.0.0.1, or private IP ranges
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    )
  } catch {
    return false
  }
}

/**
 * Image component that automatically disables optimization for local URLs.
 * This prevents Next.js from blocking private IP addresses during development.
 */
export function OptimizedImage({ src, unoptimized, alt, ...props }: ImageProps) {
  const srcString = typeof src === 'string' ? src : undefined
  const shouldSkipOptimization = unoptimized || isLocalUrl(srcString)

  return <Image src={src} alt={alt} unoptimized={shouldSkipOptimization} {...props} />
}
