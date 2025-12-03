'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/src/i18n/navigation'
import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-react'
import { routing, type Locale } from '@/src/i18n/routing'
import { cn } from '@/lib/utils'

const localeLabels: Record<Locale, string> = {
  fr: 'Francais',
  en: 'English'
}

const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧'
}

interface LocaleSwitcherProps {
  className?: string
  showLabel?: boolean
}

export function LocaleSwitcher({ className, showLabel = true }: LocaleSwitcherProps) {
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('Settings.language')

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
      <SelectTrigger className={cn('w-[140px]', className)}>
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue>
          {showLabel ? (
            <span className="flex items-center gap-2">
              <span>{localeFlags[locale]}</span>
              <span>{localeLabels[locale]}</span>
            </span>
          ) : (
            <span>{localeFlags[locale]}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {routing.locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="flex items-center gap-2">
              <span>{localeFlags[loc]}</span>
              <span>{localeLabels[loc]}</span>
            </span>
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
