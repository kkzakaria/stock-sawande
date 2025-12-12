'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlotMasked,
} from '@/components/ui/input-otp'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ShieldCheck, ShieldAlert, KeyRound, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface PinSettingsProps {
  userRole: string
}

export function PinSettings({ userRole }: PinSettingsProps) {
  const [hasPin, setHasPin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // All users can have a PIN (cashiers need it to unlock their register)
  const canHavePin = true
  const isManagerOrAdmin = ['manager', 'admin'].includes(userRole)

  useEffect(() => {
    if (canHavePin) {
      fetchPinStatus()
    } else {
      setLoading(false)
    }
  }, [canHavePin])

  const fetchPinStatus = async () => {
    try {
      const response = await fetch('/api/settings/pin')
      const data = await response.json()

      if (response.ok) {
        setHasPin(data.hasPin)
      }
    } catch (error) {
      console.error('Failed to fetch PIN status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate PIN
    if (pin.length !== 6) {
      setError('Le code PIN doit contenir 6 chiffres')
      return
    }

    if (pin !== confirmPin) {
      setError('Les codes PIN ne correspondent pas')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save PIN')
      }

      setHasPin(true)
      setShowForm(false)
      setPin('')
      setConfirmPin('')
      toast.success(hasPin ? 'Code PIN modifié' : 'Code PIN créé')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer votre code PIN ?')) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/settings/pin', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete PIN')
      }

      setHasPin(false)
      toast.success('Code PIN supprimé')
    } catch (_error) {
      toast.error('Erreur lors de la suppression du PIN')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setPin('')
    setConfirmPin('')
    setError(null)
  }

  // Don't show for non-managers
  if (!canHavePin) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Code PIN de sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Code PIN de sécurité
        </CardTitle>
        <CardDescription>
          {isManagerOrAdmin
            ? "Ce code PIN à 6 chiffres est utilisé pour approuver les fermetures de caisse avec écart et déverrouiller les caisses."
            : "Ce code PIN à 6 chiffres est utilisé pour déverrouiller votre caisse."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <div className="space-y-4">
            {/* Status display */}
            <div
              className={`flex items-center gap-3 rounded-lg p-4 ${
                hasPin
                  ? 'bg-green-50 text-green-800'
                  : 'bg-yellow-50 text-yellow-800'
              }`}
            >
              {hasPin ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
              <div>
                <p className="font-medium">
                  {hasPin
                    ? 'Code PIN configuré'
                    : 'Aucun code PIN configuré'}
                </p>
                <p className="text-sm opacity-80">
                  {hasPin
                    ? (isManagerOrAdmin
                        ? 'Vous pouvez approuver les fermetures de caisse et déverrouiller les caisses.'
                        : 'Vous pouvez déverrouiller votre caisse avec votre code PIN.')
                    : (isManagerOrAdmin
                        ? 'Configurez un code PIN pour approuver les fermetures de caisse et déverrouiller les caisses.'
                        : 'Configurez un code PIN pour pouvoir déverrouiller votre caisse.')}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={() => setShowForm(true)}>
                {hasPin ? 'Modifier le PIN' : 'Configurer le PIN'}
              </Button>
              {hasPin && (
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Security Warning */}
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <EyeOff className="h-4 w-4" />
              <AlertDescription>
                Assurez-vous que personne ne vous observe pendant la saisie de votre code PIN. Ne partagez jamais votre code avec quiconque.
              </AlertDescription>
            </Alert>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Label>Nouveau code PIN (6 chiffres)</Label>
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={(value) => setPin(value)}
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

            <div className="space-y-3">
              <Label>Confirmer le code PIN</Label>
              <InputOTP
                maxLength={6}
                value={confirmPin}
                onChange={(value) => setConfirmPin(value)}
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

            <div className="flex gap-2">
              <Button type="submit" disabled={saving || pin.length !== 6}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasPin ? 'Modifier' : 'Créer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Annuler
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
