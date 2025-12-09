'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { updateLanguage } from '@/lib/actions/profile'

interface LanguageSettingsProps {
  currentLanguage: string
}

export function LanguageSettings({ currentLanguage }: LanguageSettingsProps) {
  const t = useTranslations('Settings.language')
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage)

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === selectedLanguage) return

    setSelectedLanguage(newLanguage)

    startTransition(async () => {
      const result = await updateLanguage(newLanguage)

      if (result.success) {
        // Update the URL to reflect the new locale
        const currentPathParts = pathname.split('/')
        currentPathParts[1] = newLanguage // Replace locale segment
        const newPath = currentPathParts.join('/')

        router.push(newPath)
        router.refresh()
      } else {
        // Revert selection on error
        setSelectedLanguage(currentLanguage)
        toast.error(result.error || 'Failed to update language')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedLanguage}
          onValueChange={handleLanguageChange}
          disabled={isPending}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="fr" id="lang-fr" />
            <Label
              htmlFor="lang-fr"
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="text-lg">🇫🇷</span>
              {t('french')}
            </Label>
          </div>
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="en" id="lang-en" />
            <Label
              htmlFor="lang-en"
              className="flex items-center gap-2 cursor-pointer"
            >
              <span className="text-lg">🇬🇧</span>
              {t('english')}
            </Label>
          </div>
        </RadioGroup>

        {isPending && (
          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating language...</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
