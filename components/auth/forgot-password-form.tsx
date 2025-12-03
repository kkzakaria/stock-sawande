'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/src/i18n/navigation'
import Image from 'next/image'
import { resetPassword } from '@/app/[locale]/(auth)/actions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const t = useTranslations('Auth.forgotPassword')
  const tLogin = useTranslations('Auth.login')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await resetPassword(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccess(result.message || t('checkEmail'))
      }
    })
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form action={handleSubmit} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="text-muted-foreground text-balance">
                  {t('subtitle')}
                </p>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 text-green-900 dark:bg-green-900/10 dark:text-green-400 rounded-md p-3 text-sm">
                  {success}
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={tLogin('emailPlaceholder')}
                  required
                  disabled={isPending || !!success}
                />
              </Field>

              <Field>
                <Button type="submit" disabled={isPending || !!success}>
                  {isPending ? t('submitting') : t('submit')}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                <Link href="/login" className="underline underline-offset-2">
                  {t('backToLogin')}
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block">
            <Image
              src="/placeholder.svg"
              alt="Authentication"
              fill
              className="object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        {tLogin('termsNotice')}{' '}
        <Link href="#" className="underline underline-offset-2">
          {tLogin('termsOfService')}
        </Link>{' '}
        {tLogin('and')}{' '}
        <Link href="#" className="underline underline-offset-2">
          {tLogin('privacyPolicy')}
        </Link>
        .
      </FieldDescription>
    </div>
  )
}
