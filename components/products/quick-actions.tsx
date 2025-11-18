'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { adjustQuantity, duplicateProduct, toggleProductStatus } from '@/lib/actions/products'
import { Plus, Minus, Copy, Power } from 'lucide-react'

interface QuickActionsProps {
  productId: string
  currentQuantity: number
  isActive: boolean
}

export function QuickActions({ productId, currentQuantity, isActive }: QuickActionsProps) {
  const router = useRouter()
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [adjustment, setAdjustment] = useState(0)
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleQuickAdjust = async (value: number) => {
    setIsLoading(true)
    const result = await adjustQuantity(productId, value, `Quick adjustment: ${value > 0 ? '+' : ''}${value}`)

    if (result.success) {
      toast.success(`Stock adjusted by ${value > 0 ? '+' : ''}${value}`)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to adjust quantity')
    }
    setIsLoading(false)
  }

  const handleCustomAdjust = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for the adjustment')
      return
    }

    setIsLoading(true)
    const result = await adjustQuantity(productId, adjustment, reason)

    if (result.success) {
      toast.success(`Stock adjusted by ${adjustment > 0 ? '+' : ''}${adjustment}`)
      setShowAdjustDialog(false)
      setAdjustment(0)
      setReason('')
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to adjust quantity')
    }
    setIsLoading(false)
  }

  const handleToggleStatus = async () => {
    setIsLoading(true)
    const result = await toggleProductStatus(productId, !isActive)

    if (result.success) {
      toast.success(`Product is now ${!isActive ? 'active' : 'inactive'}`)
      router.refresh()
    } else {
      toast.error(result.error || 'Failed to update status')
    }
    setIsLoading(false)
  }

  const handleDuplicate = async () => {
    setIsLoading(true)
    const result = await duplicateProduct(productId)

    if (result.success && result.data && typeof result.data === 'object' && 'id' in result.data) {
      toast.success('Product has been duplicated')
      setShowDuplicateDialog(false)
      router.push(`/products/${result.data.id}/edit`)
    } else {
      toast.error(result.error || 'Failed to duplicate product')
    }
    setIsLoading(false)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdjust(5)}
            disabled={isLoading}
          >
            <Plus className="mr-1 h-3 w-3" />
            +5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdjust(10)}
            disabled={isLoading}
          >
            <Plus className="mr-1 h-3 w-3" />
            +10
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdjust(-5)}
            disabled={isLoading || currentQuantity < 5}
          >
            <Minus className="mr-1 h-3 w-3" />
            -5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickAdjust(-10)}
            disabled={isLoading || currentQuantity < 10}
          >
            <Minus className="mr-1 h-3 w-3" />
            -10
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdjustDialog(true)}
          disabled={isLoading}
        >
          Custom Adjust
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleStatus}
          disabled={isLoading}
        >
          <Power className="mr-1 h-3 w-3" />
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDuplicateDialog(true)}
          disabled={isLoading}
        >
          <Copy className="mr-1 h-3 w-3" />
          Duplicate
        </Button>
      </div>

      {/* Custom Adjust Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quantity</DialogTitle>
            <DialogDescription>
              Enter the adjustment amount and reason. Current stock: {currentQuantity}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adjustment">Adjustment Amount</Label>
              <Input
                id="adjustment"
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                placeholder="Enter positive or negative number"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                New quantity will be: {currentQuantity + adjustment}
              </p>
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you adjusting the stock?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCustomAdjust} disabled={isLoading || !reason.trim()}>
              {isLoading ? 'Adjusting...' : 'Adjust'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Confirmation Dialog */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a copy of this product with a new SKU (ending in -COPY).
              The duplicate will start inactive with 0 quantity for your review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicate} disabled={isLoading}>
              {isLoading ? 'Duplicating...' : 'Duplicate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
