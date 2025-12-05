import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, ShoppingCart, BarChart3, Users } from 'lucide-react'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: Props) {
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  const t = await getTranslations('Landing')

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <span className="text-xl font-bold">Next Stock</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href={`/${locale}/login`}>
              <Button variant="ghost">{t('hero.signIn')}</Button>
            </Link>
            <Link href={`/${locale}/signup`}>
              <Button>{t('hero.cta')}</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex items-center justify-center bg-gradient-to-b from-muted/50 to-background">
        <div className="container px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              {t('hero.subtitle')}
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href={`/${locale}/signup`}>
                <Button size="lg">{t('hero.cta')}</Button>
              </Link>
              <Link href={`/${locale}/login`}>
                <Button size="lg" variant="outline">
                  {t('hero.signIn')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t('features.title')}</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <Package className="h-10 w-10 text-primary" />
                <CardTitle>{t('features.products.title')}</CardTitle>
                <CardDescription>
                  {t('features.products.description')}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <ShoppingCart className="h-10 w-10 text-primary" />
                <CardTitle>{t('features.pos.title')}</CardTitle>
                <CardDescription>
                  {t('features.pos.description')}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary" />
                <CardTitle>{t('features.reports.title')}</CardTitle>
                <CardDescription>
                  {t('features.reports.description')}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary" />
                <CardTitle>{t('features.multiUser.title')}</CardTitle>
                <CardDescription>
                  {t('features.multiUser.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/50">
        <div className="container px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t('cta.title')}</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('cta.subtitle')}
            </p>
            <div className="mt-8">
              <Link href={`/${locale}/signup`}>
                <Button size="lg">{t('cta.button')}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span className="font-semibold">Next Stock</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
