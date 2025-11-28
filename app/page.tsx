import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, ShoppingCart, BarChart3, Users } from 'lucide-react'

export default function Home() {
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
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-1 items-center justify-center bg-gradient-to-b from-muted/50 to-background">
        <div className="container px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Modern Inventory Management Made Simple
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Streamline your stock management with Next Stock. Track inventory, manage sales,
              and gain insights into your business - all in one powerful platform.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg">Start Free Trial</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign In
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
            <h2 className="text-3xl font-bold tracking-tight">Everything you need to manage your inventory</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features designed for businesses of all sizes
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <Package className="h-10 w-10 text-primary" />
                <CardTitle>Product Management</CardTitle>
                <CardDescription>
                  Organize and track your entire product catalog with ease
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <ShoppingCart className="h-10 w-10 text-primary" />
                <CardTitle>Point of Sale</CardTitle>
                <CardDescription>
                  Fast and intuitive POS system for seamless transactions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary" />
                <CardTitle>Analytics & Reports</CardTitle>
                <CardDescription>
                  Gain insights with comprehensive sales and inventory reports
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary" />
                <CardTitle>Multi-User Access</CardTitle>
                <CardDescription>
                  Role-based access control for your entire team
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
            <h2 className="text-3xl font-bold tracking-tight">Ready to get started?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join businesses already using Next Stock to manage their inventory efficiently
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button size="lg">Create your account</Button>
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
              © 2025 Next Stock. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
