'use client'

import { useState } from 'react'
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
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
          Caisse fermée
        </Badge>
        <Button size="sm" onClick={onOpenSession}>
          Ouvrir la caisse
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Badge variant="default" className="gap-1 bg-green-600">
        <Wallet className="h-3 w-3" />
        Caisse ouverte
      </Badge>

      <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(session.opened_at)}
        </span>
        <span>Fond: {formatCurrency(Number(session.opening_amount))}</span>
        <span>{session.transaction_count} vente(s)</span>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={onCloseSession}
        className="gap-1"
      >
        <LogOut className="h-3 w-3" />
        Fermer
      </Button>
    </div>
  )
}
