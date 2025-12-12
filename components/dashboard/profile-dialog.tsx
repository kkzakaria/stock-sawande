'use client'

import { useState, useEffect, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useForm } from '@tanstack/react-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlotMasked,
} from '@/components/ui/input-otp'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  User,
  KeyRound,
  Globe,
  ShieldCheck,
  ShieldAlert,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile, updateLanguage } from '@/lib/actions/profile'

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: {
    full_name: string
    avatar_url: string
    email: string
    preferred_language: string
  }
  userRole: string
}

export function ProfileDialog({
  open,
  onOpenChange,
  initialData,
  userRole,
}: ProfileDialogProps) {
  const t = useTranslations('ProfileDialog')
  const tSettings = useTranslations('Settings.profile')
  const tLanguage = useTranslations('Settings.language')
  const router = useRouter()
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState('profile')

  // Profile form state
  const [isPending, startTransition] = useTransition()
  const [profileError, setProfileError] = useState<string | null>(null)

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState(initialData.preferred_language || 'fr')
  const [isLanguagePending, startLanguageTransition] = useTransition()

  // PIN state
  const [hasPin, setHasPin] = useState(false)
  const [pinLoading, setPinLoading] = useState(true)
  const [pinSaving, setPinSaving] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPinForm, setShowPinForm] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  // All users can have a PIN (cashiers need it to unlock their register)
  const canHavePin = true
  const isManagerOrAdmin = ['manager', 'admin'].includes(userRole)

  // Profile form
  const form = useForm({
    defaultValues: {
      full_name: initialData.full_name,
      avatar_url: initialData.avatar_url,
    },
    onSubmit: async ({ value }) => {
      setProfileError(null)
      startTransition(async () => {
        const result = await updateProfile(value)
        if (result.success) {
          toast.success(tSettings('success'))
          onOpenChange(false)
        } else {
          setProfileError(result.error || tSettings('error'))
        }
      })
    },
  })

  // Fetch PIN status when dialog opens
  useEffect(() => {
    if (open && canHavePin) {
      fetchPinStatus()
    }
  }, [open, canHavePin])

  // Reset states when dialog closes
  useEffect(() => {
    if (!open) {
      setActiveTab('profile')
      setShowPinForm(false)
      setPin('')
      setConfirmPin('')
      setPinError(null)
      setProfileError(null)
    }
  }, [open])

  const fetchPinStatus = async () => {
    setPinLoading(true)
    try {
      const response = await fetch('/api/settings/pin')
      const data = await response.json()
      if (response.ok) {
        setHasPin(data.hasPin)
      }
    } catch (error) {
      console.error('Failed to fetch PIN status:', error)
    } finally {
      setPinLoading(false)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError(null)

    if (pin.length !== 6) {
      setPinError(t('pin.errorLength'))
      return
    }

    if (pin !== confirmPin) {
      setPinError(t('pin.errorMismatch'))
      return
    }

    setPinSaving(true)

    try {
      const response = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save PIN')
      }

      setHasPin(true)
      setShowPinForm(false)
      setPin('')
      setConfirmPin('')
      toast.success(hasPin ? t('pin.modified') : t('pin.created'))
    } catch (error) {
      setPinError(error instanceof Error ? error.message : t('pin.error'))
    } finally {
      setPinSaving(false)
    }
  }

  const handlePinDelete = async () => {
    if (!confirm(t('pin.confirmDelete'))) {
      return
    }

    setPinSaving(true)

    try {
      const response = await fetch('/api/settings/pin', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete PIN')
      }

      setHasPin(false)
      toast.success(t('pin.deleted'))
    } catch {
      toast.error(t('pin.deleteError'))
    } finally {
      setPinSaving(false)
    }
  }

  const handlePinCancel = () => {
    setShowPinForm(false)
    setPin('')
    setConfirmPin('')
    setPinError(null)
  }

  const handleLanguageChange = async (newLanguage: string) => {
    if (newLanguage === selectedLanguage) return

    setSelectedLanguage(newLanguage)

    startLanguageTransition(async () => {
      const result = await updateLanguage(newLanguage)

      if (result.success) {
        // Update the URL to reflect the new locale
        const currentPathParts = pathname.split('/')
        currentPathParts[1] = newLanguage // Replace locale segment
        const newPath = currentPathParts.join('/')

        router.push(newPath)
        router.refresh()
        onOpenChange(false)
      } else {
        // Revert selection on error
        setSelectedLanguage(initialData.preferred_language || 'fr')
        toast.error(result.error || 'Failed to update language')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={`grid w-full ${canHavePin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {t('tabs.profile')}
            </TabsTrigger>
            <TabsTrigger value="language" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('tabs.language')}
            </TabsTrigger>
            {canHavePin && (
              <TabsTrigger value="pin" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {t('tabs.pin')}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                form.handleSubmit()
              }}
              className="space-y-4"
            >
              {profileError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {profileError}
                </div>
              )}

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">{tSettings('email')}</Label>
                <Input
                  id="email"
                  value={initialData.email}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Full Name */}
              <form.Field name="full_name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>{tSettings('fullName')}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={tSettings('fullNamePlaceholder')}
                    />
                  </div>
                )}
              </form.Field>

              {/* Avatar URL */}
              <form.Field
                name="avatar_url"
                validators={{
                  onChange: ({ value }) => {
                    if (value && value.trim().length > 0) {
                      try {
                        new URL(value)
                      } catch {
                        return t('profile.invalidUrl')
                      }
                    }
                    return undefined
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>{tSettings('avatar')}</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="url"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                    />
                    <p className="text-sm text-muted-foreground">
                      {tSettings('avatarDescription')}
                    </p>
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPending ? tSettings('saving') : tSettings('save')}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Language Tab */}
          <TabsContent value="language" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {tLanguage('description')}
              </p>
              <RadioGroup
                value={selectedLanguage}
                onValueChange={handleLanguageChange}
                disabled={isLanguagePending}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="fr" id="lang-fr" />
                  <Label
                    htmlFor="lang-fr"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-lg">🇫🇷</span>
                    {tLanguage('french')}
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="en" id="lang-en" />
                  <Label
                    htmlFor="lang-en"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-lg">🇬🇧</span>
                    {tLanguage('english')}
                  </Label>
                </div>
              </RadioGroup>

              {isLanguagePending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{tLanguage('updating')}</span>
                </div>
              )}
            </div>
          </TabsContent>

          {/* PIN Tab */}
          {canHavePin && (
            <TabsContent value="pin" className="mt-4">
              {pinLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !showPinForm ? (
                <div className="space-y-4">
                  {/* Status display */}
                  <div
                    className={`flex items-center gap-3 rounded-lg p-4 ${
                      hasPin
                        ? 'bg-green-50 text-green-800'
                        : 'bg-yellow-50 text-yellow-800'
                    }`}
                  >
                    {hasPin ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <ShieldAlert className="h-5 w-5" />
                    )}
                    <div>
                      <p className="font-medium">
                        {hasPin ? t('pin.configured') : t('pin.notConfigured')}
                      </p>
                      <p className="text-sm opacity-80">
                        {hasPin
                          ? (isManagerOrAdmin
                              ? t('pin.configuredDescriptionManager')
                              : t('pin.configuredDescriptionCashier'))
                          : (isManagerOrAdmin
                              ? t('pin.notConfiguredDescriptionManager')
                              : t('pin.notConfiguredDescriptionCashier'))}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button onClick={() => setShowPinForm(true)}>
                      {hasPin ? t('pin.modify') : t('pin.configure')}
                    </Button>
                    {hasPin && (
                      <Button
                        variant="outline"
                        onClick={handlePinDelete}
                        disabled={pinSaving}
                      >
                        {t('pin.delete')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePinSubmit} className="space-y-6">
                  {/* Security Warning */}
                  <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                    <EyeOff className="h-4 w-4" />
                    <AlertDescription>
                      {t('pin.securityWarning')}
                    </AlertDescription>
                  </Alert>

                  {pinError && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                      {pinError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label>{t('pin.newPin')}</Label>
                    <InputOTP
                      maxLength={6}
                      value={pin}
                      onChange={(value) => setPin(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlotMasked index={0} />
                        <InputOTPSlotMasked index={1} />
                        <InputOTPSlotMasked index={2} />
                        <InputOTPSlotMasked index={3} />
                        <InputOTPSlotMasked index={4} />
                        <InputOTPSlotMasked index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="space-y-3">
                    <Label>{t('pin.confirmPin')}</Label>
                    <InputOTP
                      maxLength={6}
                      value={confirmPin}
                      onChange={(value) => setConfirmPin(value)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlotMasked index={0} />
                        <InputOTPSlotMasked index={1} />
                        <InputOTPSlotMasked index={2} />
                        <InputOTPSlotMasked index={3} />
                        <InputOTPSlotMasked index={4} />
                        <InputOTPSlotMasked index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={pinSaving || pin.length !== 6}>
                      {pinSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {hasPin ? t('pin.modifyButton') : t('pin.createButton')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePinCancel}
                      disabled={pinSaving}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
