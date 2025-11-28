'use client'

/**
 * Sync Conflict Dialog Component
 * Shows conflict details and allows user to acknowledge
 */

import { useState } from 'react'
import { useOfflineStore } from '@/lib/store/offline-store'
import { updateTransactionStatus, getTransactionsByStatus } from '@/lib/offline/indexed-db'
import { formatCurrency } from '@/lib/store/cart-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, DollarSign, CheckCircle } from 'lucide-react'
import type { ConflictResolution, PendingTransaction } from '@/lib/offline/db-schema'

interface SyncConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

export function SyncConflictDialog({
  open,
  onOpenChange,
  userId,
}: SyncConflictDialogProps) {
  const [conflicts, setConflicts] = useState<PendingTransaction[]>([])
  const [selectedConflict, setSelectedConflict] = useState<PendingTransaction | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const setUnacknowledgedConflicts = useOfflineStore(
    (state) => state.setUnacknowledgedConflicts
  )

  // Load conflicts when dialog opens
  const loadConflicts = async () => {
    setIsLoading(true)
    try {
      const conflictTransactions = await getTransactionsByStatus('conflict')
      setConflicts(conflictTransactions.filter((tx) => tx.conflictResolution))
      setUnacknowledgedConflicts(conflictTransactions.length)
    } catch (error) {
      console.error('Failed to load conflicts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Acknowledge a conflict
  const handleAcknowledge = async (transaction: PendingTransaction) => {
    if (!transaction.conflictResolution) return

    const updatedResolution: ConflictResolution = {
      ...transaction.conflictResolution,
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    }

    await updateTransactionStatus(transaction.id, 'synced', {
      conflictResolution: updatedResolution,
    })

    // Reload conflicts
    await loadConflicts()

    // If no more conflicts, close dialog
    const remaining = conflicts.filter((c) => c.id !== transaction.id)
    if (remaining.length === 0) {
      onOpenChange(false)
    }
  }

  // Acknowledge all conflicts
  const handleAcknowledgeAll = async () => {
    setIsLoading(true)
    try {
      for (const conflict of conflicts) {
        await handleAcknowledge(conflict)
      }
    } finally {
      setIsLoading(false)
      onOpenChange(false)
    }
  }

  // Load conflicts when dialog opens
  if (open && conflicts.length === 0 && !isLoading) {
    loadConflicts()
  }

  const conflict = selectedConflict?.conflictResolution

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Sync Conflicts
          </DialogTitle>
          <DialogDescription>
            Some transactions had stock issues during sync. Please review and
            acknowledge.
          </DialogDescription>
        </DialogHeader>

        {!selectedConflict ? (
          // Conflict List View
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4">Loading conflicts...</div>
            ) : conflicts.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No conflicts to review
              </div>
            ) : (
              <div className="space-y-2">
                {conflicts.map((tx) => (
                  <div
                    key={tx.id}
                    className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedConflict(tx)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{tx.localReceiptNumber}</span>
                        <span className="text-gray-500 text-sm ml-2">
                          {new Date(tx.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          {tx.conflictResolution?.type === 'stock_shortage'
                            ? 'Stock Shortage'
                            : 'Unavailable'}
                        </Badge>
                        <Badge variant="destructive">
                          -{formatCurrency(tx.conflictResolution?.refundAmount || 0)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {conflicts.length > 0 && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Review Later
                </Button>
                <Button onClick={handleAcknowledgeAll} disabled={isLoading}>
                  Acknowledge All ({conflicts.length})
                </Button>
              </DialogFooter>
            )}
          </div>
        ) : (
          // Conflict Detail View
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedConflict(null)}
            >
              &larr; Back to list
            </Button>

            {/* Transaction Info */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Receipt:</span>
                <span className="font-medium">{selectedConflict.localReceiptNumber}</span>
              </div>
              {selectedConflict.serverSaleNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Server Sale #:</span>
                  <span className="font-medium">{selectedConflict.serverSaleNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span>{new Date(selectedConflict.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Conflict Alert */}
            {conflict && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  {conflict.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Affected Items */}
            {conflict && (
              <div>
                <h4 className="font-medium mb-2">Affected Items</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Fulfilled</TableHead>
                      <TableHead className="text-right">Refund</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflict.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right">
                          {item.requestedQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              item.fulfilledQuantity < item.requestedQuantity
                                ? 'text-orange-600 font-medium'
                                : ''
                            }
                          >
                            {item.fulfilledQuantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {item.refundForItem > 0
                            ? `-${formatCurrency(item.refundForItem)}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Totals Summary */}
            {conflict && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Total:</span>
                  <span>{formatCurrency(conflict.originalTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Adjusted Total:</span>
                  <span>{formatCurrency(conflict.adjustedTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-red-600 pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Refund Amount:
                  </span>
                  <span>{formatCurrency(conflict.refundAmount)}</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedConflict(null)}>
                Back
              </Button>
              <Button onClick={() => handleAcknowledge(selectedConflict)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Acknowledge Conflict
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
