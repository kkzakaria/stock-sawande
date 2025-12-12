'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlotMasked,
} from '@/components/ui/input-otp'
import {
  Loader2,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'

interface Validator {
  id: string
  full_name: string | null
  role: string
}

interface ManagerApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  discrepancy: number
  storeId: string
  onApproved: (managerId: string, pin: string) => void
  onCancel: () => void
}

export function ManagerApprovalDialog({
  open,
  onOpenChange,
  discrepancy,
  storeId: _storeId,
  onApproved,
  onCancel,
}: ManagerApprovalDialogProps) {
  const t = useTranslations('POS.approval')
  const tSession = useTranslations('POS.session')
  const tCommon = useTranslations('Common')

  const [validators, setValidators] = useState<Validator[]>([])
  const [validatorsWithoutPin, setValidatorsWithoutPin] = useState<Validator[]>([])
  const [selectedManager, setSelectedManager] = useState<string>('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const fetchValidators = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pos/session/validators')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch validators')
      }

      setValidators(data.validators || [])
      setValidatorsWithoutPin(data.validatorsWithoutPin || [])
    } catch (err) {
      console.error('Failed to fetch validators:', err)
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // Fetch validators when dialog opens
  useEffect(() => {
    if (open) {
      fetchValidators()
    } else {
      // Reset state when dialog closes
      setSelectedManager('')
      setPin('')
      setError(null)
    }
  }, [open, fetchValidators])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedManager) {
      setError(t('selectValidatorError'))
      return
    }

    if (pin.length !== 6) {
      setError(t('pinLengthError'))
      return
    }

    setValidating(true)

    try {
      // Validate the PIN via API
      const response = await fetch('/api/pos/session/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: selectedManager,
          pin: pin,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.valid) {
        throw new Error(data.error || t('invalidPin'))
      }

      // PIN is valid, call the approval callback
      onApproved(selectedManager, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('validationError'))
      setPin('') // Clear PIN on error
    } finally {
      setValidating(false)
    }
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Discrepancy display */}
          <div
            className={`rounded-lg p-4 ${
              discrepancy > 0
                ? 'bg-yellow-50 text-yellow-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                {discrepancy > 0 ? tSession('surplus') : tSession('shortage')}:{' '}
                {formatCurrency(Math.abs(discrepancy))}
              </span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : validators.length === 0 ? (
            <div className="bg-orange-50 text-orange-800 rounded-lg p-4">
              <p className="font-medium">{t('noValidators')}</p>
              <p className="text-sm mt-1">
                {validators.length === 0 && validatorsWithoutPin.length === 0
                  ? t('noValidatorsFound')
                  : t('noPinConfigured')}
              </p>
              {validatorsWithoutPin.length > 0 && (
                <p className="text-sm mt-2 opacity-80">
                  {t('managersWithoutPin')}: {validatorsWithoutPin.map((m) => m.full_name || t('unnamed')).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Manager selection */}
              <div className="space-y-2">
                <Label>{t('selectValidator')}</Label>
                <Select
                  value={selectedManager}
                  onValueChange={setSelectedManager}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectManager')} />
                  </SelectTrigger>
                  <SelectContent>
                    {validators.map((validator) => (
                      <SelectItem key={validator.id} value={validator.id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-600" />
                          <span>{validator.full_name || t('unnamed')}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            ({validator.role})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PIN input */}
              {selectedManager && (
                <div className="space-y-3">
                  <Label>{t('validatorPin')}</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={pin}
                      onChange={(value) => setPin(value)}
                      disabled={validating}
                    >
                      <InputOTPGroup>
                        <InputOTPSlotMasked index={0} />
                        <InputOTPSlotMasked index={1} />
                        <InputOTPSlotMasked index={2} />
                        <InputOTPSlotMasked index={3} />
                        <InputOTPSlotMasked index={4} />
                        <InputOTPSlotMasked index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {t('validatorPinHint')}
                  </p>
                </div>
              )}
            </>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={validating}
          >
            {tCommon('cancel')}
          </Button>
          {validators.length > 0 && (
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={validating || !selectedManager || pin.length !== 6}
            >
              {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('approve')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
