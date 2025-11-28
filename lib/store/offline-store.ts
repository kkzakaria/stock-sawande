/**
 * Offline Store (Zustand)
 * Manages global offline state: network status, sync state, pending counts
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncReport, ConflictResolution } from '@/lib/offline/db-schema'

// ============================================
// Types
// ============================================

export interface SyncError {
  id: string
  transactionId: string
  message: string
  timestamp: Date
  conflict?: ConflictResolution
}

interface OfflineState {
  // Network status
  isOnline: boolean
  lastOnlineAt: Date | null

  // Sync state
  isSyncing: boolean
  lastSyncTime: Date | null
  lastSyncReport: SyncReport | null

  // Pending counts
  pendingTransactionsCount: number

  // Errors
  syncErrors: SyncError[]
  unacknowledgedConflicts: number

  // Actions
  setOnlineStatus: (online: boolean) => void
  setSyncing: (syncing: boolean) => void
  setLastSyncTime: (time: Date) => void
  setLastSyncReport: (report: SyncReport) => void
  setPendingCount: (count: number) => void
  incrementPendingCount: () => void
  decrementPendingCount: () => void
  addSyncError: (error: SyncError) => void
  clearSyncErrors: () => void
  removeSyncError: (id: string) => void
  setUnacknowledgedConflicts: (count: number) => void
  reset: () => void
}

// ============================================
// Initial State
// ============================================

const initialState = {
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  lastOnlineAt: null,
  isSyncing: false,
  lastSyncTime: null,
  lastSyncReport: null,
  pendingTransactionsCount: 0,
  syncErrors: [],
  unacknowledgedConflicts: 0,
}

// ============================================
// Store
// ============================================

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setOnlineStatus: (online: boolean) => {
        set({
          isOnline: online,
          lastOnlineAt: online ? new Date() : get().lastOnlineAt,
        })
      },

      setSyncing: (syncing: boolean) => {
        set({ isSyncing: syncing })
      },

      setLastSyncTime: (time: Date) => {
        set({ lastSyncTime: time })
      },

      setLastSyncReport: (report: SyncReport) => {
        set({
          lastSyncReport: report,
          lastSyncTime: report.completedAt,
          unacknowledgedConflicts: report.conflicts,
        })
      },

      setPendingCount: (count: number) => {
        set({ pendingTransactionsCount: Math.max(0, count) })
      },

      incrementPendingCount: () => {
        set((state) => ({
          pendingTransactionsCount: state.pendingTransactionsCount + 1,
        }))
      },

      decrementPendingCount: () => {
        set((state) => ({
          pendingTransactionsCount: Math.max(0, state.pendingTransactionsCount - 1),
        }))
      },

      addSyncError: (error: SyncError) => {
        set((state) => ({
          syncErrors: [...state.syncErrors, error],
        }))
      },

      clearSyncErrors: () => {
        set({ syncErrors: [] })
      },

      removeSyncError: (id: string) => {
        set((state) => ({
          syncErrors: state.syncErrors.filter((e) => e.id !== id),
        }))
      },

      setUnacknowledgedConflicts: (count: number) => {
        set({ unacknowledgedConflicts: Math.max(0, count) })
      },

      reset: () => {
        set(initialState)
      },
    }),
    {
      name: 'next-stock-offline',
      partialize: (state) => ({
        lastSyncTime: state.lastSyncTime,
        pendingTransactionsCount: state.pendingTransactionsCount,
        syncErrors: state.syncErrors,
        unacknowledgedConflicts: state.unacknowledgedConflicts,
      }),
    }
  )
)

// ============================================
// Selectors (for use with shallow comparison)
// ============================================

export const selectIsOnline = (state: OfflineState) => state.isOnline
export const selectIsSyncing = (state: OfflineState) => state.isSyncing
export const selectPendingCount = (state: OfflineState) => state.pendingTransactionsCount
export const selectHasErrors = (state: OfflineState) => state.syncErrors.length > 0
export const selectHasConflicts = (state: OfflineState) => state.unacknowledgedConflicts > 0

// ============================================
// Helper to format last sync time
// ============================================

export function formatLastSyncTime(lastSync: Date | string | null): string {
  if (!lastSync) return 'Jamais'

  // Handle string dates (from localStorage persistence)
  const syncDate = typeof lastSync === 'string' ? new Date(lastSync) : lastSync

  // Validate the date
  if (isNaN(syncDate.getTime())) return 'Jamais'

  const now = new Date()
  const diff = now.getTime() - syncDate.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes}min`
  if (hours < 24) return `Il y a ${hours}h`
  return `Il y a ${days}j`
}
