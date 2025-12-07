import { LoginForm } from "@/components/auth/login-form"
import { getRedirectFromParams } from "@/lib/auth/redirect"

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const redirectUrl = getRedirectFromParams(params)

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm redirectUrl={redirectUrl} />
      </div>
    </div>
  )
}
