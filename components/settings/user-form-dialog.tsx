'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from '@tanstack/react-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateUser, updateUserStores } from '@/lib/actions/users'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Store = Database['public']['Tables']['stores']['Row']

interface UserWithStores extends Profile {
  user_stores?: {
    id: string
    store_id: string
    is_default: boolean | null
    stores: { id: string; name: string } | null
  }[]
}

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: UserWithStores | null
  stores: Store[]
  onSuccess: (user: UserWithStores) => void
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  stores,
  onSuccess,
}: UserFormDialogProps) {
  const t = useTranslations('Settings.users')
  const tAuth = useTranslations('Auth.roles')
  const tCommon = useTranslations('Common')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!user

  // Compute initial store values
  const getInitialStoreIds = () => user?.user_stores?.map((us) => us.store_id) || []
  const getInitialDefaultStore = () => {
    const storeIds = user?.user_stores?.map((us) => us.store_id) || []
    return user?.user_stores?.find((us) => us.is_default)?.store_id || storeIds[0] || ''
  }

  // Store selections state - initialized with current user values
  const [selectedStores, setSelectedStores] = useState<string[]>(getInitialStoreIds)
  const [selectedDefaultStore, setSelectedDefaultStore] = useState<string>(getInitialDefaultStore)


  const form = useForm({
    defaultValues: {
      email: user?.email || '',
      password: '',
      full_name: user?.full_name || '',
      role: (user?.role || 'cashier') as 'admin' | 'manager' | 'cashier',
    },
    onSubmit: async ({ value }) => {
      setError(null)
      startTransition(async () => {
        if (isEditing) {
          // UPDATE existing user
          const profileResult = await updateUser(user.id, {
            full_name: value.full_name,
            role: value.role,
          })

          if (!profileResult.success) {
            setError(profileResult.error || t('errors.updateFailed'))
            return
          }

          const storesResult = await updateUserStores(user.id, {
            store_ids: selectedStores,
            default_store_id: selectedDefaultStore || undefined,
          })

          if (!storesResult.success) {
            setError(storesResult.error || t('errors.updateFailed'))
            return
          }

          toast.success(t('messages.updated'))

          const updatedUser: UserWithStores = {
            ...user,
            full_name: value.full_name,
            role: value.role,
            user_stores: selectedStores.map((storeId) => ({
              id: '',
              store_id: storeId,
              is_default: storeId === selectedDefaultStore,
              stores: stores.find((s) => s.id === storeId) || null,
            })),
          }

          onSuccess(updatedUser)
        } else {
          // CREATE new user via API route
          try {
            const response = await fetch('/api/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: value.email,
                password: value.password,
                full_name: value.full_name || undefined,
                role: value.role,
                store_ids: selectedStores.length > 0 ? selectedStores : undefined,
                default_store_id: selectedDefaultStore || undefined,
              }),
            })

            const result = await response.json()

            if (!result.success) {
              // Map API errors to translated messages
              if (result.error?.includes('already exists')) {
                setError(t('errors.emailExists'))
              } else if (result.error?.includes('6 characters')) {
                setError(t('errors.passwordTooShort'))
              } else {
                setError(result.error || t('errors.createFailed'))
              }
              return
            }

            toast.success(t('messages.created'))
            onSuccess(result.data as UserWithStores)
          } catch {
            setError(t('errors.createFailed'))
          }
        }
      })
    },
  })


  const handleStoreToggle = (storeId: string, checked: boolean) => {
    if (checked) {
      setSelectedStores((prev) => [...prev, storeId])
      if (selectedStores.length === 0) {
        setSelectedDefaultStore(storeId)
      }
    } else {
      setSelectedStores((prev) => prev.filter((id) => id !== storeId))
      if (selectedDefaultStore === storeId) {
        const remaining = selectedStores.filter((id) => id !== storeId)
        setSelectedDefaultStore(remaining[0] || '')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('form.editTitle') : t('form.title')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('form.editDescription') : t('form.description')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Email */}
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!isEditing) {
                  if (!value || value.trim().length === 0) {
                    return t('errors.emailRequired')
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return t('errors.emailInvalid')
                  }
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('form.email')}</Label>
                {isEditing ? (
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                ) : (
                  <>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('form.emailPlaceholder')}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </form.Field>

          {/* Password (create mode only) */}
          {!isEditing && (
            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.length === 0) {
                    return t('errors.passwordRequired')
                  }
                  if (value.length < 6) {
                    return t('errors.passwordTooShort')
                  }
                  return undefined
                },
              }}
            >
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>{t('form.password')}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('form.passwordPlaceholder')}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-red-500">{field.state.meta.errors[0]}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{t('form.passwordHint')}</p>
                </div>
              )}
            </form.Field>
          )}

          {/* Full Name */}
          <form.Field name="full_name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('form.fullName')}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('form.fullNamePlaceholder')}
                />
              </div>
            )}
          </form.Field>

          {/* Role */}
          <form.Field name="role">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('form.role')}</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) =>
                    field.handleChange(value as 'admin' | 'manager' | 'cashier')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{tAuth('admin')}</SelectItem>
                    <SelectItem value="manager">{tAuth('manager')}</SelectItem>
                    <SelectItem value="cashier">{tAuth('cashier')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          {/* Store Assignments */}
          <div className="space-y-2">
            <Label>{t('form.stores')}</Label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
              {stores.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stores available</p>
              ) : (
                stores.map((store) => (
                  <div key={store.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`store-${store.id}`}
                      checked={selectedStores.includes(store.id)}
                      onCheckedChange={(checked) =>
                        handleStoreToggle(store.id, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`store-${store.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {store.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Default Store */}
          {selectedStores.length > 0 && (
            <div className="space-y-2">
              <Label>{t('form.defaultStore')}</Label>
              <Select value={selectedDefaultStore} onValueChange={setSelectedDefaultStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select default store" />
                </SelectTrigger>
                <SelectContent>
                  {selectedStores.map((storeId) => {
                    const store = stores.find((s) => s.id === storeId)
                    return (
                      <SelectItem key={storeId} value={storeId}>
                        {store?.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPending
                ? isEditing
                  ? t('form.updating')
                  : t('form.creating')
                : isEditing
                  ? t('form.update')
                  : t('form.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
