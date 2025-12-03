'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Wallet,
  CreditCard,
  Smartphone,
  Banknote,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
} from 'lucide-react'
import { Tables } from '@/types/supabase'
import { ManagerApprovalDialog } from './manager-approval-dialog'

type CashSession = Tables<'cash_sessions'>

interface CloseSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: CashSession | null
  storeId: string
  onSessionClosed: () => void
}

export function CloseSessionDialog({
  open,
  onOpenChange,
  session,
  storeId,
  onSessionClosed,
}: CloseSessionDialogProps) {
  const t = useTranslations('POS.session')
  const tCommon = useTranslations('Common')

  const [closingAmount, setClosingAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)

  if (!session) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Calculate expected closing amount
  const openingAmount = Number(session.opening_amount) || 0
  const totalCashSales = Number(session.total_cash_sales) || 0
  const expectedClosing = openingAmount + totalCashSales

  // Calculate discrepancy if closing amount is entered
  const enteredAmount = parseFloat(closingAmount) || 0
  const discrepancy = closingAmount ? enteredAmount - expectedClosing : null

  // Check if there's a discrepancy that requires approval
  const hasDiscrepancy = discrepancy !== null && Math.abs(discrepancy) > 0.001

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!closingAmount) {
      setError(t('enterFinalAmount'))
      return
    }

    // If there's a discrepancy, show the approval dialog
    if (hasDiscrepancy) {
      setShowApprovalDialog(true)
      return
    }

    // No discrepancy, proceed with closing directly
    await closeSession()
  }

  const closeSession = async (approvedBy?: string, approverPin?: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pos/session/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          closingAmount: parseFloat(closingAmount),
          notes: notes || undefined,
          approvedBy,
          approverPin,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to close session')
      }

      // Reset form
      setClosingAmount('')
      setNotes('')
      setShowApprovalDialog(false)
      onSessionClosed()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (managerId: string, pin: string) => {
    await closeSession(managerId, pin)
  }

  const handleApprovalCancel = () => {
    setShowApprovalDialog(false)
  }

  const totalSales =
    Number(session.total_cash_sales || 0) +
    Number(session.total_card_sales || 0) +
    Number(session.total_mobile_sales || 0) +
    Number(session.total_other_sales || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t('close')}
          </DialogTitle>
          <DialogDescription>
            {t('closeDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 py-4 flex-1 overflow-y-auto">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Session Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">{t('sessionSummary')}</h4>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-green-600" />
                  <span>{t('cashPayments')}:</span>
                </div>
                <span className="text-right font-medium">
                  {formatCurrency(Number(session.total_cash_sales || 0))}
                </span>

                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span>{t('cardPayments')}:</span>
                </div>
                <span className="text-right font-medium">
                  {formatCurrency(Number(session.total_card_sales || 0))}
                </span>

                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-purple-600" />
                  <span>{t('mobilePayments')}:</span>
                </div>
                <span className="text-right font-medium">
                  {formatCurrency(Number(session.total_mobile_sales || 0))}
                </span>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span>{t('transactionCount')}:</span>
                <span className="font-medium">{session.transaction_count}</span>
              </div>

              <div className="flex justify-between font-medium">
                <span>{t('totalSales')}:</span>
                <span>{formatCurrency(totalSales)}</span>
              </div>
            </div>

            {/* Cash Calculation */}
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-blue-900">{t('cashCalculation')}</h4>
              <div className="grid grid-cols-2 gap-1 text-sm text-blue-800">
                <span>{t('openingFund')}:</span>
                <span className="text-right">{formatCurrency(openingAmount)}</span>
                <span>+ {t('cashSales')}:</span>
                <span className="text-right">{formatCurrency(totalCashSales)}</span>
              </div>
              <Separator className="bg-blue-200" />
              <div className="flex justify-between font-bold text-blue-900">
                <span>{t('expectedCash')}:</span>
                <span>{formatCurrency(expectedClosing)}</span>
              </div>
            </div>

            {/* Closing Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="closingAmount">{t('finalCountedAmount')} ($)</Label>
              <Input
                id="closingAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
                className="text-lg font-medium"
                autoFocus
              />
            </div>

            {/* Discrepancy Display */}
            {discrepancy !== null && (
              <div
                className={`rounded-lg p-3 flex items-center gap-2 ${
                  discrepancy === 0
                    ? 'bg-green-50 text-green-800'
                    : discrepancy > 0
                      ? 'bg-yellow-50 text-yellow-800'
                      : 'bg-red-50 text-red-800'
                }`}
              >
                {discrepancy === 0 ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <div className="flex-1">
                  <span className="font-medium">
                    {discrepancy === 0
                      ? t('balanced')
                      : discrepancy > 0
                        ? `${t('surplus')}: ${formatCurrency(discrepancy)}`
                        : `${t('shortage')}: ${formatCurrency(Math.abs(discrepancy))}`}
                  </span>
                  {hasDiscrepancy && (
                    <p className="text-xs mt-1 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      {t('managerValidationRequired')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t('closingNotesOptional')}</Label>
              <Textarea
                id="notes"
                placeholder={t('closingNotesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={loading || !closingAmount}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasDiscrepancy ? t('requestValidation') : t('close')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Manager Approval Dialog */}
      <ManagerApprovalDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        discrepancy={discrepancy || 0}
        storeId={storeId}
        onApproved={handleApproval}
        onCancel={handleApprovalCancel}
      />
    </Dialog>
  )
}
