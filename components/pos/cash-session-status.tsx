'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Wallet, Clock, DoorOpen, Receipt } from 'lucide-react'
import { Tables } from '@/types/supabase'

type CashSession = Tables<'cash_sessions'>

interface CashSessionStatusProps {
  session: CashSession | null
  onOpenSession: () => void
  onCloseSession: () => void
}

export function CashSessionStatus({
  session,
  onOpenSession,
  onCloseSession,
}: CashSessionStatusProps) {
  const t = useTranslations('POS.session')
  const tStatus = useTranslations('POS.status')

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1">
          <Wallet className="h-3 w-3" />
          {tStatus('registerClosed')}
        </Badge>
        <Button size="sm" onClick={onOpenSession}>
          {t('open')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant="default" className="gap-1 bg-green-600">
        <Wallet className="h-3 w-3" />
        {tStatus('registerOpen')}
      </Badge>

      <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(session.opened_at)}
        </span>
        <span>{tStatus('fund')}: {formatCurrency(Number(session.opening_amount))}</span>
        <span>{session.transaction_count} {tStatus('sales')}</span>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-400"
          >
            <DoorOpen className="h-4 w-4" />
            {t('close')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t('closeConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('closeConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tStatus('sales')}:</span>
              <span className="font-medium">{session.transaction_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tStatus('fund')}:</span>
              <span className="font-medium">{formatCurrency(Number(session.opening_amount))}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('closeCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onCloseSession}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              <DoorOpen className="mr-2 h-4 w-4" />
              {t('closeProceed')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
