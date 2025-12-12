'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'

interface AddToStoreDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableStores: Array<{ id: string; name: string }>
  onConfirm: (storeId: string, quantity: number) => void
  isPending: boolean
}

export function AddToStoreDialog({
  open,
  onOpenChange,
  availableStores,
  onConfirm,
  isPending,
}: AddToStoreDialogProps) {
  const t = useTranslations('Products.form.addToStoreDialog')
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('0')
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    setError(null)

    if (!selectedStoreId) {
      setError(t('selectStoreError'))
      return
    }

    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty < 0) {
      setError(t('invalidQuantityError'))
      return
    }

    onConfirm(selectedStoreId, qty)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setSelectedStoreId('')
      setQuantity('0')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="store">{t('selectStore')}</Label>
            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
              disabled={isPending}
            >
              <SelectTrigger id="store">
                <SelectValue placeholder={t('selectStorePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableStores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">{t('initialQuantity')}</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPending}
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? t('adding') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
