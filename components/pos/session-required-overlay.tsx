'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Wallet, AlertCircle, Store } from 'lucide-react'

interface SessionRequiredOverlayProps {
  onOpenSession: () => void
  canSelectStore?: boolean
  onChangeStore?: () => void
}

export function SessionRequiredOverlay({
  onOpenSession,
  canSelectStore = false,
  onChangeStore,
}: SessionRequiredOverlayProps) {
  const t = useTranslations('POS.session')
  const tStore = useTranslations('POS.storeSelector')

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center space-y-6 max-w-md p-8">
        <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
          <Wallet className="h-8 w-8 text-orange-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{t('registerClosed')}</h2>
          <p className="text-muted-foreground">
            {t('registerClosedDescription')}
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{t('whatIsOpeningFund')}</p>
              <p className="text-muted-foreground">
                {t('openingFundExplanation')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={onOpenSession} className="gap-2">
            <Wallet className="h-5 w-5" />
            {t('openMyRegister')}
          </Button>

          {canSelectStore && onChangeStore && (
            <Button
              variant="outline"
              size="lg"
              onClick={onChangeStore}
              className="gap-2"
            >
              <Store className="h-5 w-5" />
              {tStore('changeStore')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
