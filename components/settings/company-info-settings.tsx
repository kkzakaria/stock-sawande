'use client'

import { useState, useTransition, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Building2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateCompanyInfoSettings } from '@/lib/actions/business-settings'

interface CompanyInfoSettingsProps {
  initialData: {
    name: string
    taxId: string
    address: string
    phone: string
    email: string
    website: string
    logoUrl: string
  }
}

export function CompanyInfoSettings({ initialData }: CompanyInfoSettingsProps) {
  const t = useTranslations('Settings.business.companyInfo')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState(initialData.name)
  const [taxId, setTaxId] = useState(initialData.taxId)
  const [address, setAddress] = useState(initialData.address)
  const [phone, setPhone] = useState(initialData.phone)
  const [email, setEmail] = useState(initialData.email)
  const [website, setWebsite] = useState(initialData.website)
  const [logoUrl, setLogoUrl] = useState(initialData.logoUrl)
  const [logoPreview, setLogoPreview] = useState<string | null>(initialData.logoUrl || null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError(t('errors.logoTooLarge'))
        return
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(t('errors.invalidLogoType'))
        return
      }

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setLogoPreview(base64)
        setLogoUrl(base64) // Store as base64 for now
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoUrl('')
    setLogoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSave = () => {
    setError(null)

    if (!name.trim()) {
      setError(t('errors.nameRequired'))
      return
    }

    startTransition(async () => {
      const result = await updateCompanyInfoSettings({
        name: name.trim(),
        taxId: taxId.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        website: website.trim(),
        logoUrl: logoUrl,
      })

      if (result.success) {
        toast.success(t('success'))
      } else {
        setError(result.error || t('error'))
      }
    })
  }

  const getCompanyInitials = () => {
    if (!name) return 'CO'
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Logo Section */}
        <div className="space-y-3">
          <Label>{t('logo')}</Label>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={logoPreview || undefined} alt={name || 'Company logo'} />
              <AvatarFallback className="text-lg">{getCompanyInitials()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('uploadLogo')}
              </Button>
              {logoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('removeLogo')}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {t('logoHelp')}
              </p>
            </div>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="company-name">{t('name')} *</Label>
          <Input
            id="company-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
        </div>

        {/* Tax ID */}
        <div className="space-y-2">
          <Label htmlFor="tax-id">{t('taxId')}</Label>
          <Input
            id="tax-id"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder={t('taxIdPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('taxIdHelp')}
          </p>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="company-address">{t('address')}</Label>
          <Textarea
            id="company-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('addressPlaceholder')}
            rows={3}
          />
        </div>

        {/* Phone and Email Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company-phone">{t('phone')}</Label>
            <Input
              id="company-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-email">{t('email')}</Label>
            <Input
              id="company-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
            />
          </div>
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="company-website">{t('website')}</Label>
          <Input
            id="company-website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder={t('websitePlaceholder')}
          />
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t('save')}
        </Button>
      </CardContent>
    </Card>
  )
}
