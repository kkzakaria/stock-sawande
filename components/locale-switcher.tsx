'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/src/i18n/navigation'
import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { routing, type Locale } from '@/src/i18n/routing'
import { cn } from '@/lib/utils'

const localeCodes: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN'
}

const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English'
}

interface LocaleSwitcherProps {
  className?: string
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const handleLocaleChange = (newLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale as Locale })
    })

    // Save to user profile if authenticated
    saveUserLanguagePreference(newLocale as Locale)
  }

  return (
    <Select
      value={locale}
      onValueChange={handleLocaleChange}
      disabled={isPending}
    >
      <SelectTrigger className={cn('w-[70px]', className)}>
        <SelectValue>{localeCodes[locale]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {localeNames[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

async function saveUserLanguagePreference(locale: Locale) {
  try {
    await fetch('/api/settings/language', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: locale })
    })
  } catch (error) {
    console.error('Error saving language preference:', error)
  }
}
