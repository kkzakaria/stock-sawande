declare module 'next-pwa' {
  import { NextConfig } from 'next'

  interface RuntimeCachingRule {
    urlPattern: RegExp | string
    handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate'
    options?: {
      cacheName?: string
      expiration?: {
        maxEntries?: number
        maxAgeSeconds?: number
      }
      networkTimeoutSeconds?: number
      backgroundSync?: {
        name: string
        options?: {
          maxRetentionTime?: number
        }
      }
    }
  }

  interface PWAConfig {
    dest: string
    register?: boolean
    skipWaiting?: boolean
    disable?: boolean
    scope?: string
    sw?: string
    runtimeCaching?: RuntimeCachingRule[]
    publicExcludes?: string[]
    buildExcludes?: (string | RegExp)[]
    dynamicStartUrl?: boolean
    fallbacks?: {
      document?: string
      image?: string
      font?: string
      audio?: string
      video?: string
    }
  }

  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig
  export default withPWA
}
