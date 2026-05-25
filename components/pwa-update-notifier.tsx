'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function PwaUpdateNotifier() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let toastShown = false

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (toastShown) return
      toastShown = true
      toast.info('Nouvelle version disponible', {
        description: "Rechargez pour mettre à jour l'application.",
        action: {
          label: 'Recharger',
          onClick: () => window.location.reload(),
        },
        duration: Infinity,
      })
    })

    const checkForUpdate = () => {
      navigator.serviceWorker.ready
        .then(reg => reg.update())
        .catch(() => {})
    }

    checkForUpdate()

    // Check every 60s — covers the case where the user never switches tabs
    const interval = setInterval(checkForUpdate, 60_000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return null
}
