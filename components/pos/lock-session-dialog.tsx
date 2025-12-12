'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { Lock, Loader2 } from 'lucide-react'

interface LockSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  onSessionLocked: () => void
}

export function LockSessionDialog({
  open,
  onOpenChange,
  sessionId,
  onSessionLocked,
}: LockSessionDialogProps) {
  const t = useTranslations('POS.session')
  const tCommon = useTranslations('Common')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLock = async () => {
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/pos/session/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to lock session')
      }

      onSessionLocked()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'))
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t('lockTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('lockDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {tCommon('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLock}
            disabled={loading}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Lock className="mr-2 h-4 w-4" />
            {loading ? t('locking') : t('lockConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
