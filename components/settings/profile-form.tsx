'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from '@tanstack/react-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { updateProfile } from '@/lib/actions/profile'

interface ProfileFormProps {
  initialData: {
    full_name: string
    avatar_url: string
    email: string
  }
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const t = useTranslations('Settings.profile')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      full_name: initialData.full_name,
      avatar_url: initialData.avatar_url,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      startTransition(async () => {
        const result = await updateProfile(value)
        if (result.success) {
          toast.success(t('success'))
        } else {
          setError(result.error || t('error'))
        }
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              value={initialData.email}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Full Name */}
          <form.Field
            name="full_name"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) {
                  return undefined // Optional field
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('fullName')}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('fullNamePlaceholder')}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500">
                    {field.state.meta.errors[0]}
                  </p>
                )}
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
                    return 'Invalid URL format'
                  }
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('avatar')}</Label>
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
                  {t('avatarDescription')}
                </p>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
