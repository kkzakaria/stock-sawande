'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/src/i18n/navigation'
import Image from 'next/image'
import { verifyOtp } from '@/app/[locale]/(auth)/actions'
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'

export function OTPForm({ className, ...props }: React.ComponentProps<'div'>) {
  const t = useTranslations('Auth.otp')
  const tLogin = useTranslations('Auth.login')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [otp, setOtp] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('token', otp)

    startTransition(async () => {
      const result = await verifyOtp(formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div
      className={cn('flex flex-col gap-6 md:min-h-[450px]', className)}
      {...props}
    >
      <Card className="flex-1 overflow-hidden p-0">
        <CardContent className="grid flex-1 p-0 md:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col items-center justify-center p-6 md:p-8"
          >
            <FieldGroup>
              <Field className="items-center text-center">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  {t('subtitle')}
                </p>
              </Field>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                  {error}
                </div>
              )}

              <Field>
                <FieldLabel htmlFor="email">{tLogin('email')}</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={tLogin('emailPlaceholder')}
                  required
                  disabled={isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="otp" className="sr-only">
                  {t('title')}
                </FieldLabel>
                <InputOTP
                  maxLength={6}
                  id="otp"
                  value={otp}
                  onChange={setOtp}
                  disabled={isPending}
                  containerClassName="gap-4"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </Field>

              <Field>
                <Button type="submit" disabled={isPending || otp.length !== 6}>
                  {isPending ? t('submitting') : t('submit')}
                </Button>
              </Field>
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
      <FieldDescription className="text-center">
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
