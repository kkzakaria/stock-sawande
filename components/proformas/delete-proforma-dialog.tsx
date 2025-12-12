'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
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
import { deleteProforma, type ProformaWithDetails } from '@/lib/actions/proformas'

interface DeleteProformaDialogProps {
  proforma: ProformaWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeleteProformaDialog({
  proforma,
  open,
  onOpenChange,
  onSuccess,
}: DeleteProformaDialogProps) {
  const t = useTranslations('Proformas')
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!proforma) return

    setLoading(true)
    try {
      const result = await deleteProforma(proforma.id)

      if (result.success) {
        toast.success(t('delete.success'))
        onOpenChange(false)
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error(t('delete.error'), {
          description: result.error,
        })
      }
    } catch {
      toast.error(t('delete.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!proforma) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('delete.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.description', { proformaNumber: proforma.proforma_number })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('delete.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('delete.confirm')}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
