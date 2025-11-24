'use client'

import { Button } from '@/components/ui/button'
import { Wallet, AlertCircle } from 'lucide-react'

interface SessionRequiredOverlayProps {
  onOpenSession: () => void
}

export function SessionRequiredOverlay({
  onOpenSession,
}: SessionRequiredOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center space-y-6 max-w-md p-8">
        <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
          <Wallet className="h-8 w-8 text-orange-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Caisse fermée</h2>
          <p className="text-muted-foreground">
            Vous devez ouvrir une session de caisse avant de pouvoir effectuer
            des ventes. Cela permet de suivre les transactions et de faire le
            bilan en fin de journée.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Qu&apos;est-ce que le fond de caisse ?</p>
              <p className="text-muted-foreground">
                C&apos;est le montant initial en espèces dans votre tiroir-caisse au
                début de votre session de travail.
              </p>
            </div>
          </div>
        </div>

        <Button size="lg" onClick={onOpenSession} className="gap-2">
          <Wallet className="h-5 w-5" />
          Ouvrir ma caisse
        </Button>
      </div>
    </div>
  )
}
