'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wallet, Clock, LogOut } from 'lucide-react'
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

      <Button
        size="sm"
        variant="outline"
        onClick={onCloseSession}
        className="gap-1"
      >
        <LogOut className="h-3 w-3" />
        {t('close')}
      </Button>
    </div>
  )
}
