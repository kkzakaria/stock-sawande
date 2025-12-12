'use client'

import { useState } from 'react'
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
import { Wallet, Clock, DoorOpen, Receipt, ShoppingCart, AlertTriangle, Lock } from 'lucide-react'
import { Tables } from '@/types/supabase'

type CashSession = Tables<'cash_sessions'>

interface CashSessionStatusProps {
  session: CashSession | null
  onOpenSession: () => void
  onCloseSession: () => void
  onLockSession: () => void
  cartItemCount?: number
}

export function CashSessionStatus({
  session,
  onOpenSession,
  onCloseSession,
  onLockSession,
  cartItemCount = 0,
}: CashSessionStatusProps) {
  const t = useTranslations('POS.session')
  const tStatus = useTranslations('POS.status')
  const [dialogOpen, setDialogOpen] = useState(false)

  const hasItemsInCart = cartItemCount > 0

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

      <Button
        size="sm"
        onClick={onLockSession}
        className="gap-1 bg-amber-500 text-white hover:bg-amber-600"
      >
        <Lock className="h-4 w-4" />
        {t('lock')}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            className="gap-1 bg-black text-white hover:bg-gray-800"
          >
            <DoorOpen className="h-4 w-4" />
            {t('close')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          {hasItemsInCart ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  {t('cartNotEmptyTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('cartNotEmptyDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="font-medium">
                    {t('cartItemsCount', { count: cartItemCount })}
                  </span>
                </div>
                <p className="text-amber-700">
                  {t('cartNotEmptyHint')}
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('understood')}</AlertDialogCancel>
              </AlertDialogFooter>
            </>
          ) : (
            <>
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
                  onClick={() => {
                    setDialogOpen(false)
                    onCloseSession()
                  }}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <DoorOpen className="mr-2 h-4 w-4" />
                  {t('closeProceed')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
