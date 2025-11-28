'use client'

import { useState, useTransition } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { refundSale, type SaleWithDetails } from '@/lib/actions/sales'

interface RefundDialogProps {
  sale: SaleWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function RefundDialog({
  sale,
  open,
  onOpenChange,
  onSuccess,
}: RefundDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRefund = () => {
    if (!sale) return

    if (!reason.trim()) {
      setError('Please provide a reason for the refund')
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await refundSale(sale.id, reason.trim())

      if (result.success) {
        toast.success('Sale refunded successfully')
        setReason('')
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        setError(result.error || 'Failed to refund sale')
        toast.error(result.error || 'Failed to refund sale')
      }
    })
  }

  const handleClose = () => {
    if (!isPending) {
      setReason('')
      setError(null)
      onOpenChange(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (!sale) return null

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Refund Sale
          </AlertDialogTitle>
          <AlertDialogDescription>
            You are about to refund sale <strong className="font-mono">{sale.sale_number}</strong> for{' '}
            <strong>{formatCurrency(sale.total)}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              This action will:
            </p>
            <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
              <li>Mark the sale as refunded</li>
              <li>Restore inventory for all items</li>
              <li>Create stock movement records</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for refund <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for this refund..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
              disabled={isPending}
              rows={3}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRefund}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Refund'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
