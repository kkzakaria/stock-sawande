'use client'

/**
 * Network Status Indicator Component
 * Shows online/offline status with sync information
 */

import { useEffect, useCallback, useState } from 'react'
import { useOfflineStore, formatLastSyncTime } from '@/lib/store/offline-store'
import { useSyncService } from '@/lib/offline/sync-service'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface NetworkStatusIndicatorProps {
  storeId?: string
  showDetails?: boolean
  className?: string
  onSyncComplete?: () => void
}

export function NetworkStatusIndicator({
  storeId,
  showDetails = true,
  className = '',
  onSyncComplete,
}: NetworkStatusIndicatorProps) {
  // Read from the store (updated by useNetworkStatus hook in pos-client)
  const isOnline = useOfflineStore((state) => state.isOnline)
  const lastOnlineAt = useOfflineStore((state) => state.lastOnlineAt)
  const setOnlineStatus = useOfflineStore((state) => state.setOnlineStatus)
  const pendingCount = useOfflineStore((state) => state.pendingTransactionsCount)
  const lastSyncTime = useOfflineStore((state) => state.lastSyncTime)
  const unacknowledgedConflicts = useOfflineStore(
    (state) => state.unacknowledgedConflicts
  )

  const [isChecking, setIsChecking] = useState(false)

  // Manual connection check
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const online = response.ok
      setOnlineStatus(online)
      return online
    } catch {
      setOnlineStatus(false)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [setOnlineStatus])

  const { triggerSync, syncProducts, isSyncing, canSync } = useSyncService()

  const handleSync = useCallback(async () => {
    const report = await triggerSync()

    if (report) {
      if (report.successful > 0) {
        toast.success(`Synced ${report.successful} transaction(s)`)
      }
      if (report.conflicts > 0) {
        toast.warning(`${report.conflicts} transaction(s) had stock conflicts`)
      }
      if (report.failed > 0) {
        toast.error(`${report.failed} transaction(s) failed to sync`)
      }
    }

    // Sync products with forceFullSync=true after transactions to get updated stock levels
    // This is needed because product_templates.updated_at doesn't change when inventory is updated
    if (storeId) {
      const hadTransactions = report ? report.totalTransactions > 0 : false
      await syncProducts(storeId, hadTransactions)
    }

    // Notify parent to refresh data from server
    if (onSyncComplete) {
      onSyncComplete()
    }
  }, [triggerSync, storeId, syncProducts, onSyncComplete])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      // Delay sync slightly to ensure connection is stable
      const timer = setTimeout(() => {
        handleSync()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, pendingCount, handleSync])

  const handleManualCheck = async () => {
    const online = await checkConnection()
    if (online) {
      toast.success('Connexion rétablie')
    } else {
      toast.error('Toujours hors ligne')
    }
  }

  // Simple indicator (no popover)
  if (!showDetails) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {isOnline ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Wifi className="h-3 w-3 mr-1" />
            Online
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
            {pendingCount > 0 && ` (${pendingCount})`}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`relative ${className}`}
        >
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-orange-600" />
          )}

          {/* Pending count badge */}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}

          {/* Conflict indicator */}
          {unacknowledgedConflicts > 0 && (
            <span className="absolute -bottom-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center">
              !
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700">Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-700">Offline</span>
                </>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualCheck}
              disabled={isSyncing || isChecking}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing || isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Sync Status */}
          <div className="space-y-2 text-sm">
            {/* Last Sync */}
            <div className="flex items-center justify-between text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Last sync:</span>
              </div>
              <span>{formatLastSyncTime(lastSyncTime)}</span>
            </div>

            {/* Pending Transactions */}
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pending sales:</span>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  {pendingCount}
                </Badge>
              </div>
            )}

            {/* Conflicts */}
            {unacknowledgedConflicts > 0 && (
              <div className="flex items-center justify-between text-red-600">
                <span>Needs attention:</span>
                <Badge variant="destructive">{unacknowledgedConflicts}</Badge>
              </div>
            )}
          </div>

          {/* Last Online */}
          {!isOnline && lastOnlineAt && (
            <div className="text-xs text-gray-500">
              Dernière connexion: {new Date(lastOnlineAt).toLocaleTimeString()}
            </div>
          )}

          {/* Sync Button */}
          {canSync && (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full"
              size="sm"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now ({pendingCount})
                </>
              )}
            </Button>
          )}

          {/* Offline Message */}
          {!isOnline && (
            <p className="text-xs text-gray-500 text-center">
              Sales will be saved locally and synced when back online.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
