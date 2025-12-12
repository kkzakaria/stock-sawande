'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Send, CheckCircle, XCircle } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { updateProformaStatus, type ProformaWithDetails } from '@/lib/actions/proformas'

interface UpdateStatusDialogProps {
  proforma: ProformaWithDetails | null
  action: 'sent' | 'accepted' | 'rejected'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function UpdateStatusDialog({
  proforma,
  action,
  open,
  onOpenChange,
  onSuccess,
}: UpdateStatusDialogProps) {
  const t = useTranslations('Proformas')
  const [loading, setLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const handleSubmit = async () => {
    if (!proforma) return

    setLoading(true)
    try {
      const result = await updateProformaStatus({
        proforma_id: proforma.id,
        status: action,
        rejection_reason: action === 'rejected' ? rejectionReason : undefined,
      })

      if (result.success) {
        toast.success(t(`statusUpdate.${action}.success`))
        onOpenChange(false)
        setRejectionReason('')
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error(t('statusUpdate.error'), {
          description: result.error,
        })
      }
    } catch {
      toast.error(t('statusUpdate.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!proforma) return null

  const getIcon = () => {
    switch (action) {
      case 'sent':
        return <Send className="h-5 w-5 text-blue-600" />
      case 'accepted':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />
    }
  }

  const getButtonVariant = () => {
    switch (action) {
      case 'rejected':
        return 'destructive' as const
      default:
        return 'default' as const
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {t(`statusUpdate.${action}.title`)}
          </DialogTitle>
          <DialogDescription>
            {t(`statusUpdate.${action}.description`, { proformaNumber: proforma.proforma_number })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {action === 'rejected' && (
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">{t('statusUpdate.rejected.reasonLabel')}</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('statusUpdate.rejected.reasonPlaceholder')}
                rows={3}
              />
            </div>
          )}

          {action === 'sent' && (
            <p className="text-sm text-muted-foreground">
              {t('statusUpdate.sent.note')}
            </p>
          )}

          {action === 'accepted' && (
            <p className="text-sm text-muted-foreground">
              {t('statusUpdate.accepted.note')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant={getButtonVariant()}
            onClick={handleSubmit}
            disabled={loading || (action === 'rejected' && !rejectionReason.trim())}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('statusUpdate.processing')}
              </>
            ) : (
              t(`statusUpdate.${action}.confirm`)
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
