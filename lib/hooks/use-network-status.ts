/**
 * Network Status Hook
 * Detects and tracks online/offline status with periodic connectivity checks
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
// Constants
// ============================================

const PING_URL = '/api/health' // A lightweight endpoint to check connectivity
const PING_TIMEOUT = 3000 // 3 seconds timeout
const CHECK_INTERVAL = 15000 // Check every 15 seconds when online
const OFFLINE_CHECK_INTERVAL = 3000 // Check every 3 seconds when offline

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

  // Keep ref in sync with state
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  /**
   * Check actual connectivity by making a network request
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
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
      setIsOnline(online)
      setOnlineStatus(online)

      if (online) {
        setLastOnline(new Date())
      }

      return online
    } catch {
      // Network error or timeout - we're offline
      setIsOnline(false)
      setOnlineStatus(false)
      setLastCheck(new Date())
      return false
    }
  }, [setOnlineStatus])

  /**
   * Handle browser online/offline events
   */
  const handleOnline = useCallback(() => {
    setIsOnline(true)
    setOnlineStatus(true)
    setLastOnline(new Date())
    // Verify connectivity with a real check (deferred)
    setTimeout(checkConnection, 100)
  }, [checkConnection, setOnlineStatus])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
    setOnlineStatus(false)
  }, [setOnlineStatus])

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
    }
  }, [])

  // Set up event listeners and initial check
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Browser events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Network Information API events
    const connection = (navigator as Navigator & { connection?: NetworkInformation })
      .connection
    if (connection) {
      connection.addEventListener('change', updateConnectionInfo)
    }

    // Initial connectivity check on mount (deferred to avoid synchronous setState)
    const initialCheckTimeout = setTimeout(checkConnection, 100)

    return () => {
      clearTimeout(initialCheckTimeout)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      if (connection) {
        connection.removeEventListener('change', updateConnectionInfo)
      }
    }
  }, [handleOnline, handleOffline, updateConnectionInfo, checkConnection])

  // Manage periodic connectivity checks based on online status
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Clear existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    // Set new interval based on current status
    const interval = isOnline ? CHECK_INTERVAL : OFFLINE_CHECK_INTERVAL
    checkIntervalRef.current = setInterval(checkConnection, interval)

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
