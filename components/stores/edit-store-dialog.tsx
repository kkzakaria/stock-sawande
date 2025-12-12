'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from '@tanstack/react-form'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { updateStore } from '@/lib/actions/stores'
import { AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface Store {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

interface EditStoreDialogProps {
  store: Store | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditStoreDialog({
  store,
  open,
  onOpenChange,
}: EditStoreDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('Stores.form')
  const tMessages = useTranslations('Stores')

  const form = useForm({
    defaultValues: {
      name: store?.name || '',
      email: store?.email || '',
      phone: store?.phone || '',
      address: store?.address || '',
    },
    onSubmit: async ({ value }) => {
      if (!store) return

      setError(null)
      startTransition(async () => {
        const result = await updateStore(store.id, value)

        if (result.success) {
          onOpenChange(false)
          toast.success(tMessages('messages.updated'))
          router.refresh()
        } else {
          setError(result.error || t('errors.generic'))
        }
      })
    },
  })

  // Reset form when store changes
  useEffect(() => {
    if (store) {
      form.reset()
      form.setFieldValue('name', store.name)
      form.setFieldValue('email', store.email || '')
      form.setFieldValue('phone', store.phone || '')
      form.setFieldValue('address', store.address || '')
    }
  }, [store, form])

  // Clear error when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('editTitle')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.length === 0) {
                    return t('errors.nameRequired')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('fields.name')} *
                  </label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.namePlaceholder')}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm font-medium text-destructive">
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="address">
              {(field) => (
                <div className="space-y-2">
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t('fields.address')}
                  </label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('fields.addressPlaceholder')}
                    className="resize-none"
                    rows={2}
                  />
                </div>
              )}
            </form.Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="phone">
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor={field.name}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t('fields.phone')}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="tel"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('fields.phonePlaceholder')}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }) => {
                    if (value && value.length > 0) {
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                      if (!emailRegex.test(value)) {
                        return t('errors.invalidEmail')
                      }
                    }
                    return undefined
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <label
                      htmlFor={field.name}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t('fields.email')}
                    </label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('fields.emailPlaceholder')}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm font-medium text-destructive">
                        {field.state.meta.errors[0]}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('buttons.updating') : t('buttons.update')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
