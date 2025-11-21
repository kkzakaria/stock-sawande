/**
 * Hook to detect when component is hydrated on client
 * Prevents hydration mismatch for client-only features
 * Uses useSyncExternalStore for proper React 18+ hydration handling
 */

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // Client value
    () => false // Server value
  )
}
