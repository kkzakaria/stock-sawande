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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createCategory, updateCategory } from '@/lib/actions/categories'
import type { Database } from '@/types/database.types'

type Category = Database['public']['Tables']['categories']['Row']

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  onSuccess: (category: Category) => void
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryFormDialogProps) {
  const t = useTranslations('Settings.categories')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!category

  const form = useForm({
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
    },
    onSubmit: async ({ value }) => {
      setError(null)
      startTransition(async () => {
        const result = isEditing
          ? await updateCategory(category!.id, value)
          : await createCategory(value)

        if (result.success) {
          toast.success(isEditing ? t('messages.updated') : t('messages.created'))
          onSuccess(result.data as Category)
          form.reset()
        } else {
          setError(result.error || (isEditing ? t('errors.updateFailed') : t('errors.createFailed')))
        }
      })
    },
  })

  // Reset form when category changes
  if (category && form.state.values.name !== category.name) {
    form.setFieldValue('name', category.name)
    form.setFieldValue('description', category.description || '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('form.editTitle') : t('form.title')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modify the category details'
              : 'Add a new category to organize your products'}
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
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Name */}
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.trim().length === 0) {
                  return t('errors.nameRequired')
                }
                return undefined
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('form.name')}</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('form.namePlaceholder')}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Description */}
          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>{t('form.description')}</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPending
                ? (isEditing ? t('form.updating') : t('form.creating'))
                : (isEditing ? t('form.update') : t('form.create'))}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
