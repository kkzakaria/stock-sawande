'use client'

import { useState, useEffect } from 'react'
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
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  Loader2,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Manager {
  id: string
  full_name: string | null
  role: string
  hasPin: boolean
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
  storeId,
  onApproved,
  onCancel,
}: ManagerApprovalDialogProps) {
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedManager, setSelectedManager] = useState<string>('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  // Fetch managers/admins with PINs when dialog opens
  useEffect(() => {
    if (open) {
      fetchManagers()
    } else {
      // Reset state when dialog closes
      setSelectedManager('')
      setPin('')
      setError(null)
    }
  }, [open])

  const fetchManagers = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get current user to exclude from list
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Fetch managers from the same store + all admins (admins can approve any store)
      // Admins may have store_id = null, so we fetch them separately
      const { data: storeManagers, error: managersError } = await supabase
        .from('profiles')
        .select('id, full_name, role, store_id')
        .eq('role', 'manager')
        .eq('store_id', storeId)

      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, full_name, role, store_id')
        .eq('role', 'admin')

      if (managersError || adminsError) {
        throw managersError || adminsError
      }

      // Combine managers and admins
      const profiles = [...(storeManagers || []), ...(admins || [])]

      // Filter out current user and check which ones have PINs
      const managersWithPinStatus: Manager[] = []

      for (const profile of profiles || []) {
        // Skip current user - they can't approve their own session
        if (profile.id === user?.id) continue

        // Check if this manager has a PIN configured
        const { data: pinRecord } = await supabase
          .from('manager_pins')
          .select('id')
          .eq('user_id', profile.id)
          .single()

        managersWithPinStatus.push({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
          hasPin: !!pinRecord,
        })
      }

      setManagers(managersWithPinStatus)
    } catch (err) {
      console.error('Failed to fetch managers:', err)
      setError('Impossible de charger la liste des managers')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedManager) {
      setError('Veuillez sélectionner un validateur')
      return
    }

    if (pin.length !== 6) {
      setError('Le code PIN doit contenir 6 chiffres')
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
        throw new Error(data.error || 'Code PIN invalide')
      }

      // PIN is valid, call the approval callback
      onApproved(selectedManager, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de validation')
      setPin('') // Clear PIN on error
    } finally {
      setValidating(false)
    }
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const managersWithPin = managers.filter((m) => m.hasPin)
  const managersWithoutPin = managers.filter((m) => !m.hasPin)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Validation requise
          </DialogTitle>
          <DialogDescription>
            Un écart a été détecté. L&apos;approbation d&apos;un manager ou
            administrateur est nécessaire pour fermer cette caisse.
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
                {discrepancy > 0 ? 'Excédent' : 'Manque'}:{' '}
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
          ) : managersWithPin.length === 0 ? (
            <div className="bg-orange-50 text-orange-800 rounded-lg p-4">
              <p className="font-medium">Aucun validateur disponible</p>
              <p className="text-sm mt-1">
                {managers.length === 0
                  ? 'Aucun manager ou admin trouvé pour ce magasin.'
                  : 'Aucun manager ou admin n\'a configuré son code PIN. Veuillez contacter un administrateur.'}
              </p>
              {managersWithoutPin.length > 0 && (
                <p className="text-sm mt-2 opacity-80">
                  Managers sans PIN: {managersWithoutPin.map((m) => m.full_name || 'Sans nom').join(', ')}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Manager selection */}
              <div className="space-y-2">
                <Label>Sélectionner le validateur</Label>
                <Select
                  value={selectedManager}
                  onValueChange={setSelectedManager}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un manager ou admin" />
                  </SelectTrigger>
                  <SelectContent>
                    {managersWithPin.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-600" />
                          <span>{manager.full_name || 'Sans nom'}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            ({manager.role})
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
                  <Label>Code PIN du validateur</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={pin}
                      onChange={(value) => setPin(value)}
                      disabled={validating}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Le validateur doit saisir son code PIN personnel
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
            Annuler
          </Button>
          {managersWithPin.length > 0 && (
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={validating || !selectedManager || pin.length !== 6}
            >
              {validating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Valider
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
