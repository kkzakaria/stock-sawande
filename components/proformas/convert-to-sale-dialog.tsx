'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Loader2, ShoppingCart, CreditCard, Banknote, Smartphone, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { convertProformaToSale, type ProformaWithDetails } from '@/lib/actions/proformas'

interface ConvertToSaleDialogProps {
  proforma: ProformaWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other'

export function ConvertToSaleDialog({
  proforma,
  open,
  onOpenChange,
  onSuccess,
}: ConvertToSaleDialogProps) {
  const t = useTranslations('Proformas')
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentReference, setPaymentReference] = useState('')

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const handleConvert = async () => {
    if (!proforma) return

    setLoading(true)
    try {
      const result = await convertProformaToSale(
        proforma.id,
        paymentMethod,
        paymentReference || undefined
      )

      if (result.success && result.data) {
        toast.success(t('convert.success'), {
          description: t('convert.saleCreated', { saleNumber: result.data.sale_number }),
        })
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
        // Optionally redirect to sale detail
        router.push(`/sales?search=${result.data.sale_number}`)
      } else {
        toast.error(t('convert.error'), {
          description: result.error,
        })
      }
    } catch {
      toast.error(t('convert.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!proforma) return null

  const paymentOptions = [
    { value: 'cash', label: t('paymentMethods.cash'), icon: Banknote, color: 'text-green-600' },
    { value: 'card', label: t('paymentMethods.card'), icon: CreditCard, color: 'text-blue-600' },
    { value: 'mobile', label: t('paymentMethods.mobile'), icon: Smartphone, color: 'text-purple-600' },
    { value: 'other', label: t('paymentMethods.other'), icon: Receipt, color: 'text-gray-600' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('convert.title')}
          </DialogTitle>
          <DialogDescription>
            {t('convert.description', { proformaNumber: proforma.proforma_number })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('convert.proforma')}</span>
              <span className="font-mono">{proforma.proforma_number}</span>
            </div>
            {proforma.customer && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('convert.customer')}</span>
                <span>{proforma.customer.name}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>{t('convert.total')}</span>
              <span>{formatCurrency(proforma.total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label>{t('convert.paymentMethod')}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              className="grid grid-cols-2 gap-3"
            >
              {paymentOptions.map((option) => {
                const Icon = option.icon
                return (
                  <div key={option.value}>
                    <RadioGroupItem
                      value={option.value}
                      id={option.value}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.value}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <Icon className={`h-6 w-6 mb-2 ${option.color}`} />
                      <span className="text-sm font-medium">{option.label}</span>
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          {/* Payment Reference (for card/mobile) */}
          {['card', 'mobile', 'other'].includes(paymentMethod) && (
            <div className="space-y-2">
              <Label htmlFor="paymentReference">{t('convert.paymentReference')}</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={t('convert.paymentReferencePlaceholder')}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleConvert} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('convert.converting')}
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t('convert.confirm')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
