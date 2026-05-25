'use client'

import { useEffect } from 'react'

export function PwaUpdateNotifier() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Auto-reload when a new SW takes control. The module-level flag resets
    // on each page load, preventing infinite reload loops.
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })

    const checkForUpdate = () => {
      navigator.serviceWorker.ready
        .then(reg => reg.update())
        .catch(() => {})
    }

    checkForUpdate()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return null
}
