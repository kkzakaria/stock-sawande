/**
 * Network Status Hook
 * Detects and tracks online/offline status with fast connectivity detection
 *
 * Features:
 * - Optimized polling intervals for faster detection
 * - Fetch interception for instant offline detection
 * - Network Information API integration
 * - Visibility-aware polling (pauses when tab hidden)
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOfflineStore } from '@/lib/store/offline-store'

// ============================================
// Types
// ============================================

interface NetworkStatus {
  isOnline: boolean
  isSlowConnection: boolean
  connectionType: string | null
  lastOnline: Date | null
  lastCheck: Date | null
  checkConnection: () => Promise<boolean>
}

interface NetworkInformation extends EventTarget {
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
}

// ============================================
// Constants - Optimized for fast detection
// ============================================

const PING_URL = '/api/health'
const PING_TIMEOUT = 1500 // 1.5s timeout (was 3s)
const CHECK_INTERVAL = 5000 // Check every 5s when online (was 15s)
const OFFLINE_CHECK_INTERVAL = 2000 // Check every 2s when offline (was 3s)
const CONSECUTIVE_FAILURES_THRESHOLD = 2 // Number of failures before marking offline

// ============================================
// Fetch Interceptor for instant offline detection
// ============================================

type NetworkEventCallback = (isOnline: boolean) => void
const networkEventListeners = new Set<NetworkEventCallback>()

// Track consecutive failures for more reliable detection
let consecutiveFailures = 0
let isInterceptorInstalled = false

function installFetchInterceptor() {
  if (typeof window === 'undefined' || isInterceptorInstalled) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args)

      // Successful request = we're online
      if (consecutiveFailures > 0) {
        consecutiveFailures = 0
        notifyNetworkChange(true)
      }

      return response
    } catch (error) {
      // Check if it's a network error (not abort or other errors)
      if (
        error instanceof TypeError &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed'))
      ) {
        consecutiveFailures++

        // Only mark offline after consecutive failures to avoid false positives
        if (consecutiveFailures >= CONSECUTIVE_FAILURES_THRESHOLD) {
          notifyNetworkChange(false)
        }
      }

      throw error
    }
  }

  isInterceptorInstalled = true
}

function notifyNetworkChange(isOnline: boolean) {
  networkEventListeners.forEach((callback) => callback(isOnline))
}

function subscribeToNetworkEvents(callback: NetworkEventCallback) {
  networkEventListeners.add(callback)
  return () => networkEventListeners.delete(callback)
}

// ============================================
// Hook
// ============================================

export function useNetworkStatus(): NetworkStatus {
  const setOnlineStatus = useOfflineStore((state) => state.setOnlineStatus)

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isSlowConnection, setIsSlowConnection] = useState(false)
  const [connectionType, setConnectionType] = useState<string | null>(null)
  const [lastOnline, setLastOnline] = useState<Date | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isOnlineRef = useRef(isOnline)
  const isVisibleRef = useRef(true)

  // Keep ref in sync with state
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  /**
   * Update online status with deduplication
   */
  const updateOnlineStatus = useCallback(
    (online: boolean) => {
      if (isOnlineRef.current !== online) {
        setIsOnline(online)
        setOnlineStatus(online)

        if (online) {
          setLastOnline(new Date())
          consecutiveFailures = 0
        }
      }
    },
    [setOnlineStatus]
  )

  /**
   * Check actual connectivity by making a network request
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    // Skip check if tab is hidden to save resources
    if (!isVisibleRef.current) {
      return isOnlineRef.current
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT)

      const response = await fetch(PING_URL, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      setLastCheck(new Date())

      const online = response.ok
      updateOnlineStatus(online)

      return online
    } catch {
      // Network error or timeout - we're offline
      updateOnlineStatus(false)
      setLastCheck(new Date())
      return false
    }
  }, [updateOnlineStatus])

  /**
   * Handle browser online/offline events
   */
  const handleOnline = useCallback(() => {
    updateOnlineStatus(true)
    // Verify connectivity with a real check (deferred)
    setTimeout(checkConnection, 50)
  }, [checkConnection, updateOnlineStatus])

  const handleOffline = useCallback(() => {
    updateOnlineStatus(false)
  }, [updateOnlineStatus])

  /**
   * Handle fetch interceptor notifications
   */
  const handleFetchNetworkChange = useCallback(
    (online: boolean) => {
      if (!online) {
        // Verify with a real check before marking offline
        checkConnection()
      } else {
        updateOnlineStatus(true)
      }
    },
    [checkConnection, updateOnlineStatus]
  )

  /**
   * Handle visibility change - check connection when tab becomes visible
   */
  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = document.visibilityState === 'visible'

    if (isVisibleRef.current) {
      // Check connection immediately when tab becomes visible
      checkConnection()
    }
  }, [checkConnection])

  /**
   * Update connection info from Network Information API
   */
  const updateConnectionInfo = useCallback(() => {
    if (typeof navigator === 'undefined') return

    const connection = (navigator as Navigator & { connection?: NetworkInformation })
      .connection

    if (connection) {
      setConnectionType(connection.effectiveType)
      setIsSlowConnection(
        connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g'
      )

      // Slow connection might indicate connectivity issues
      if (connection.effectiveType === 'slow-2g' && isOnlineRef.current) {
        checkConnection()
      }
    }
  }, [checkConnection])

  // Install fetch interceptor and set up event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Install fetch interceptor for instant detection
    installFetchInterceptor()

    // Subscribe to fetch interceptor events
    const unsubscribeFetch = subscribeToNetworkEvents(handleFetchNetworkChange)

    // Browser events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Visibility change for tab focus detection
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Network Information API events
    const connection = (navigator as Navigator & { connection?: NetworkInformation })
      .connection
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo)
    }

    // Initial connectivity check on mount
    const initialCheckTimeout = setTimeout(checkConnection, 50)

    return () => {
      clearTimeout(initialCheckTimeout)
      unsubscribeFetch()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo)
      }
    }
  }, [
    handleOnline,
    handleOffline,
    handleFetchNetworkChange,
    handleVisibilityChange,
    updateConnectionInfo,
    checkConnection,
  ])

  // Manage periodic connectivity checks based on online status
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Clear existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    // Set new interval based on current status
    const interval = isOnline ? CHECK_INTERVAL : OFFLINE_CHECK_INTERVAL
    checkIntervalRef.current = setInterval(() => {
      // Only check if tab is visible
      if (isVisibleRef.current) {
        checkConnection()
      }
    }, interval)

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [isOnline, checkConnection])

  return {
    isOnline,
    isSlowConnection,
    connectionType,
    lastOnline,
    lastCheck,
    checkConnection,
  }
}

// ============================================
// Simple hook for just online/offline status
// ============================================

export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
