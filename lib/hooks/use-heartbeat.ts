/**
 * SSE Heartbeat Hook
 * Provides ultra-fast offline detection using Server-Sent Events
 *
 * When the network connection drops, the SSE connection fails immediately,
 * allowing detection in <500ms instead of waiting for polling intervals.
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useOfflineStore } from '@/lib/store/offline-store'

// ============================================
// Constants
// ============================================

const HEARTBEAT_URL = '/api/heartbeat'
const RECONNECT_DELAY = 2000 // Wait 2s before reconnecting
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BACKOFF_MULTIPLIER = 1.5

// ============================================
// Hook
// ============================================

interface UseHeartbeatOptions {
  /** Enable/disable the heartbeat connection (default: true) */
  enabled?: boolean
  /** Callback when connection status changes */
  onStatusChange?: (isConnected: boolean) => void
}

export function useHeartbeat(options: UseHeartbeatOptions = {}) {
  const { enabled = true, onStatusChange } = options

  const setOnlineStatus = useOfflineStore((state) => state.setOnlineStatus)
  const isOnline = useOfflineStore((state) => state.isOnline)

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isVisibleRef = useRef(true)

  // Use refs to break circular dependencies and access latest values
  const isOnlineRef = useRef(isOnline)
  const onStatusChangeRef = useRef(onStatusChange)
  const enabledRef = useRef(enabled)
  const createConnectionRef = useRef<() => void>(() => {})

  // Keep refs in sync
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  /**
   * Clean up existing connection
   */
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  /**
   * Schedule reconnection with exponential backoff
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return

    const delay =
      RECONNECT_DELAY *
      Math.pow(RECONNECT_BACKOFF_MULTIPLIER, reconnectAttemptsRef.current)

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++
      // Use ref to access latest createConnection function
      createConnectionRef.current()
    }, delay)
  }, [])

  /**
   * Create and connect to EventSource
   */
  const createConnection = useCallback(() => {
    if (!enabledRef.current || !isVisibleRef.current) return

    // Clean up existing connection
    cleanup()

    try {
      const eventSource = new EventSource(HEARTBEAT_URL)
      eventSourceRef.current = eventSource

      eventSource.addEventListener('connected', () => {
        reconnectAttemptsRef.current = 0
        setOnlineStatus(true)
        onStatusChangeRef.current?.(true)
      })

      eventSource.addEventListener('heartbeat', () => {
        if (!isOnlineRef.current) {
          setOnlineStatus(true)
          onStatusChangeRef.current?.(true)
        }
        reconnectAttemptsRef.current = 0
      })

      eventSource.addEventListener('offline', () => {
        eventSource.close()
        eventSourceRef.current = null
        setOnlineStatus(false)
        onStatusChangeRef.current?.(false)
        scheduleReconnect()
      })

      eventSource.onerror = () => {
        eventSource.close()
        eventSourceRef.current = null
        setOnlineStatus(false)
        onStatusChangeRef.current?.(false)
        scheduleReconnect()
      }
    } catch {
      // EventSource not supported or other error
      setOnlineStatus(false)
      onStatusChangeRef.current?.(false)
    }
  }, [cleanup, setOnlineStatus, scheduleReconnect])

  // Keep the ref updated with the latest createConnection
  useEffect(() => {
    createConnectionRef.current = createConnection
  }, [createConnection])

  /**
   * Handle visibility change
   */
  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = document.visibilityState === 'visible'

    if (isVisibleRef.current) {
      // Tab became visible - reconnect
      reconnectAttemptsRef.current = 0
      createConnection()
    } else {
      // Tab hidden - disconnect to save resources
      cleanup()
    }
  }, [createConnection, cleanup])

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    createConnection()
  }, [createConnection])

  // Set up connection and event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Connect on mount
    createConnection()

    // Handle visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cleanup()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [createConnection, cleanup, handleVisibilityChange])

  return {
    /** Force reconnection to the heartbeat endpoint */
    reconnect,
    /** Disconnect from the heartbeat endpoint */
    disconnect: cleanup,
  }
}
