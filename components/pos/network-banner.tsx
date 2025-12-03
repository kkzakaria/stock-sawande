'use client'

/**
 * Network Banner Component
 * Shows a banner when network status changes (offline/online)
 */

import { useEffect, useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useOfflineStore } from '@/lib/store/offline-store'
import { Wifi, WifiOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NetworkBanner() {
  const t = useTranslations('POS.offline.banner')
  const tCommon = useTranslations('Common')

  const isOnline = useOfflineStore((state) => state.isOnline)
  const pendingCount = useOfflineStore((state) => state.pendingTransactionsCount)

  const [showBanner, setShowBanner] = useState(false)
  const [bannerType, setBannerType] = useState<'offline' | 'online'>('offline')
  const [isAnimating, setIsAnimating] = useState(false)

  const previousOnlineRef = useRef(isOnline)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip first render to avoid showing banner on initial load
    if (isFirstRender.current) {
      isFirstRender.current = false
      previousOnlineRef.current = isOnline
      return
    }

    // Only show banner when status actually changes
    if (previousOnlineRef.current !== isOnline) {
      // Clear any existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }

      // Defer state updates to avoid synchronous setState in effect
      const showTimeout = setTimeout(() => {
        setBannerType(isOnline ? 'online' : 'offline')
        setShowBanner(true)
        setIsAnimating(true)
      }, 0)

      // Auto-hide online banner after 4 seconds
      if (isOnline) {
        hideTimeoutRef.current = setTimeout(() => {
          setIsAnimating(false)
          setTimeout(() => setShowBanner(false), 300) // Wait for animation
        }, 4000)
      }

      previousOnlineRef.current = isOnline

      return () => {
        clearTimeout(showTimeout)
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
        }
      }
    }
  }, [isOnline])

  const handleDismiss = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    setIsAnimating(false)
    setTimeout(() => setShowBanner(false), 300)
  }

  if (!showBanner) return null

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out',
        isAnimating ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center gap-3 px-4 py-3 text-white shadow-lg',
          bannerType === 'offline'
            ? 'bg-gradient-to-r from-orange-500 to-red-500'
            : 'bg-gradient-to-r from-green-500 to-emerald-500'
        )}
      >
        {bannerType === 'offline' ? (
          <>
            <WifiOff className="h-5 w-5 animate-pulse" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium">{t('disconnected')}</span>
              <span className="text-sm opacity-90">
                {t('disconnectedHint')}
                {pendingCount > 0 && ` (${t('pending', { count: pendingCount })})`}
              </span>
            </div>
          </>
        ) : (
          <>
            <Wifi className="h-5 w-5" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium">{t('reconnected')}</span>
              <span className="text-sm opacity-90">
                {pendingCount > 0
                  ? t('syncing', { count: pendingCount })
                  : t('synced')
                }
              </span>
            </div>
          </>
        )}

        <button
          onClick={handleDismiss}
          className="ml-auto p-1 hover:bg-white/20 rounded-full transition-colors"
          aria-label={tCommon('close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
