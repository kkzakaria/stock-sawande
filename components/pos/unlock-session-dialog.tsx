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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Unlock, UserCheck, ShieldCheck } from 'lucide-react'

interface Validator {
  id: string
  full_name: string | null
  role: string
}

interface UnlockSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  isOwner: boolean
  onSessionUnlocked: () => void
}

export function UnlockSessionDialog({
  open,
  onOpenChange,
  sessionId,
  isOwner,
  onSessionUnlocked,
}: UnlockSessionDialogProps) {
  const t = useTranslations('POS.session')
  const tApproval = useTranslations('POS.approval')
  const tCommon = useTranslations('Common')

  const [mode, setMode] = useState<'self' | 'manager'>('self')
  const [pin, setPin] = useState('')
  const [validators, setValidators] = useState<Validator[]>([])
  const [selectedManager, setSelectedManager] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [validatorsLoading, setValidatorsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchValidators = useCallback(async () => {
    setValidatorsLoading(true)
    try {
      const response = await fetch('/api/pos/session/validators')
      const data = await response.json()

      if (response.ok) {
        setValidators(data.validators || [])
      }
    } catch (err) {
      console.error('Failed to fetch validators:', err)
    } finally {
      setValidatorsLoading(false)
    }
  }, [])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setMode(isOwner ? 'self' : 'manager')
      setPin('')
      setSelectedManager('')
      setError(null)
      if (!isOwner) {
        fetchValidators()
      }
    }
  }, [open, isOwner, fetchValidators])

  // Fetch validators when switching to manager mode
  useEffect(() => {
    if (mode === 'manager' && validators.length === 0) {
      fetchValidators()
    }
  }, [mode, validators.length, fetchValidators])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (pin.length !== 6) {
      setError(t('invalidPin'))
      return
    }

    if (mode === 'manager' && !selectedManager) {
      setError(tApproval('selectValidatorError'))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/pos/session/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          pin,
          validatorId: mode === 'manager' ? selectedManager : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('unlockError'))
      }

      onSessionUnlocked()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unlockError'))
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5" />
            {t('unlockTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('unlockDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {isOwner ? (
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'self' | 'manager')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="self" className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t('unlock')}
                </TabsTrigger>
                <TabsTrigger value="manager" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  {t('managerUnlock')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="self" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <Label>{t('enterPin')}</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={pin}
                      onChange={setPin}
                      disabled={loading}
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
                </div>
              </TabsContent>

              <TabsContent value="manager" className="space-y-4 mt-4">
                {validatorsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : validators.length === 0 ? (
                  <div className="bg-orange-50 text-orange-800 rounded-lg p-4">
                    <p className="text-sm">{tApproval('noValidatorsFound')}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{tApproval('selectValidator')}</Label>
                      <Select
                        value={selectedManager}
                        onValueChange={setSelectedManager}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={tApproval('selectManager')} />
                        </SelectTrigger>
                        <SelectContent>
                          {validators.map((validator) => (
                            <SelectItem key={validator.id} value={validator.id}>
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-green-600" />
                                <span>{validator.full_name || 'Unnamed'}</span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  ({validator.role})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedManager && (
                      <div className="space-y-3">
                        <Label>{tApproval('validatorPin')}</Label>
                        <div className="flex justify-center">
                          <InputOTP
                            maxLength={6}
                            value={pin}
                            onChange={setPin}
                            disabled={loading}
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
                          {tApproval('validatorPinHint')}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            // Non-owner: manager unlock only
            <>
              {validatorsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : validators.length === 0 ? (
                <div className="bg-orange-50 text-orange-800 rounded-lg p-4">
                  <p className="text-sm">{tApproval('noValidatorsFound')}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {t('managerUnlockHint')}
                  </p>

                  <div className="space-y-2">
                    <Label>{tApproval('selectValidator')}</Label>
                    <Select
                      value={selectedManager}
                      onValueChange={setSelectedManager}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={tApproval('selectManager')} />
                      </SelectTrigger>
                      <SelectContent>
                        {validators.map((validator) => (
                          <SelectItem key={validator.id} value={validator.id}>
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-green-600" />
                              <span>{validator.full_name || 'Unnamed'}</span>
                              <span className="text-xs text-muted-foreground capitalize">
                                ({validator.role})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedManager && (
                    <div className="space-y-3">
                      <Label>{tApproval('validatorPin')}</Label>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={pin}
                          onChange={setPin}
                          disabled={loading}
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
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={
              loading ||
              pin.length !== 6 ||
              (mode === 'manager' && !selectedManager)
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Unlock className="mr-2 h-4 w-4" />
            {loading ? t('unlocking') : t('unlockConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
