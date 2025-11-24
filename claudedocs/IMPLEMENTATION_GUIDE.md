# Implementation Guide

Comprehensive phase-by-phase guide to build the Next-Stock application from foundation to production.

## Overview

This guide provides step-by-step implementation instructions for building a complete stock management and POS system. Each phase builds on previous work, with complete code examples, testing strategies, and best practices.

**Prerequisites:**
- Completed [QUICK_START.md](./QUICK_START.md)
- Database tables created
- Development environment running

**Total Timeline:** 10 weeks (2 developers)

**Phase Progress:**
- Phase 1: Foundation (2 weeks) - ██████████ 100% ✅
- Phase 2: Core Features (3 weeks) - ██████████ 100% ✅
- Phase 3: POS System (3 weeks) - ███████░░░ 70% 🔄
- Phase 4: Analytics (2 weeks) - ░░░░░░░░░░ 0%

**Overall Progress:** 70% (7/10 weeks complete)

**Phase 3 Status:**
- ✅ POS Interface, Cart, Checkout
- ✅ Receipt System (Print/Download)
- ✅ Multi-Cashier Realtime Sync
- 🔲 Cash Drawer Management
- 🔲 Sales History
- 🔲 Offline Mode (low priority)

---

## Phase 1: Foundation (2 weeks)

**Goals:** Establish authentication, database connections, and base UI layout

**Deliverables:**
- ✅ Supabase client configuration (browser, server, middleware)
- ✅ Authentication flow (login, signup, logout)
- ✅ Protected routes with middleware
- ✅ Dashboard layout with navigation
- ✅ User profile management

---

### Task 1.1: Supabase Client Setup

**Objective:** Configure Supabase clients for different Next.js execution contexts

**Files to Create:**

#### `/home/superz/next-stock/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Usage:** Client Components, browser-side operations

#### `/home/superz/next-stock/lib/supabase/server.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle error in Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle error in Server Component
          }
        },
      },
    }
  )
}
```

**Usage:** Server Components, Server Actions, Route Handlers

#### `/home/superz/next-stock/middleware.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/products', '/sales', '/pos', '/reports']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect unauthenticated users to login
  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (request.nextUrl.pathname.startsWith('/auth') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Testing:**

```bash
# Test client creation in browser console
# Navigate to http://localhost:3000
# Open DevTools Console
const { createClient } = await import('/lib/supabase/client.ts')
const supabase = createClient()
console.log(supabase) // Should show Supabase client object
```

✅ **Success Criteria:**
- No TypeScript errors
- Middleware redirects unauthenticated users
- Authenticated users can access dashboard
- Session persists across page reloads

---

### Task 1.2: Authentication Pages

**Objective:** Implement login, signup, and logout functionality

**Files to Create:**

#### `/home/superz/next-stock/app/auth/login/page.tsx`

```typescript
import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Login | Next-Stock',
  description: 'Sign in to your account',
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <a
              href="/auth/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              create a new account
            </a>
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
```

#### `/home/superz/next-stock/components/auth/login-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
```

#### `/home/superz/next-stock/app/auth/signup/page.tsx`

```typescript
import { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Sign Up | Next-Stock',
  description: 'Create a new account',
}

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <a
              href="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </a>
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
```

#### `/home/superz/next-stock/components/auth/signup-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // Redirect to dashboard (auto-signed in after signup)
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-sm text-gray-500">
            Minimum 6 characters
          </p>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign up'}
      </Button>
    </form>
  )
}
```

#### `/home/superz/next-stock/app/auth/logout/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_SITE_URL))
}
```

**Testing:**

1. **Signup Flow:**
```bash
# Navigate to http://localhost:3000/auth/signup
# Fill form: Full Name, Email, Password
# Submit → Should redirect to /dashboard
# Check Supabase Dashboard → Authentication → Users
# Verify new user created
```

2. **Login Flow:**
```bash
# Navigate to http://localhost:3000/auth/login
# Enter credentials from signup
# Submit → Should redirect to /dashboard
# Refresh page → Should stay authenticated
```

3. **Logout Flow:**
```bash
# From dashboard, trigger logout action
# Should redirect to /auth/login
# Try accessing /dashboard → Should redirect to login
```

✅ **Success Criteria:**
- User can create account with email/password
- User can sign in with credentials
- Session persists across page reloads
- Protected routes redirect unauthenticated users
- Profile created automatically in `profiles` table

---

### Task 1.3: Base Dashboard Layout

**Objective:** Create responsive dashboard layout with navigation

**Files to Create:**

#### `/home/superz/next-stock/app/dashboard/layout.tsx`

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/nav'
import { UserNav } from '@/components/dashboard/user-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch user profile with store information
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, store:stores(*)')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-white">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <h1 className="text-xl font-bold">Next-Stock</h1>
          </div>
          <DashboardNav />
        </div>
      </aside>

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b bg-white">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              {profile?.store && (
                <p className="text-sm text-gray-500">
                  {profile.store.name}
                </p>
              )}
            </div>
            <UserNav user={user} profile={profile} />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
```

#### `/home/superz/next-stock/components/dashboard/nav.tsx`

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Store,
  Settings,
} from 'lucide-react'

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Products',
    href: '/products',
    icon: Package,
  },
  {
    title: 'POS',
    href: '/pos',
    icon: ShoppingCart,
  },
  {
    title: 'Sales',
    href: '/sales',
    icon: BarChart3,
  },
  {
    title: 'Stores',
    href: '/stores',
    icon: Store,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="h-5 w-5" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
```

#### `/home/superz/next-stock/components/dashboard/user-nav.tsx`

```typescript
'use client'

import { User } from '@supabase/supabase-js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, User as UserIcon } from 'lucide-react'

interface UserNavProps {
  user: User
  profile: any
}

export function UserNav({ user, profile }: UserNavProps) {
  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || user.email?.substring(0, 2).toUpperCase()

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{profile?.full_name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings/profile">
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

#### `/home/superz/next-stock/app/dashboard/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch user's store
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id')
    .eq('id', user!.id)
    .single()

  if (!profile?.store_id) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-gray-500">No store assigned. Contact administrator.</p>
      </div>
    )
  }

  // Fetch dashboard metrics
  const [productsCount, todaySales, lowStockCount] = await Promise.all([
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', profile.store_id),
    supabase
      .from('sales')
      .select('total_amount')
      .eq('store_id', profile.store_id)
      .gte('created_at', new Date().toISOString().split('T')[0]),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', profile.store_id)
      .lt('stock_quantity', 'min_stock_level'),
  ])

  const totalSalesToday = todaySales.data?.reduce(
    (sum, sale) => sum + Number(sale.total_amount),
    0
  ) || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's your store overview.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Products
            </CardTitle>
            <Package className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsCount.count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Today's Sales
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalSalesToday.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Low Stock Items
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {lowStockCount.count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Transactions
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaySales.data?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/products/new"
              className="block rounded-lg border p-3 hover:bg-gray-50"
            >
              Add New Product
            </a>
            <a
              href="/pos"
              className="block rounded-lg border p-3 hover:bg-gray-50"
            >
              Open POS
            </a>
            <a
              href="/reports"
              className="block rounded-lg border p-3 hover:bg-gray-50"
            >
              View Reports
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Activity log coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Testing:**

```bash
# 1. Log in and navigate to /dashboard
# Expected: Dashboard loads with sidebar navigation

# 2. Check metrics display
# Expected: Product count, sales, low stock count visible

# 3. Click navigation items
# Expected: Active state highlights current page

# 4. Click user avatar → Profile
# Expected: Dropdown shows email and logout option
```

✅ **Success Criteria:**
- Dashboard layout renders with sidebar
- Navigation highlights active page
- User avatar displays initials
- Metrics cards show real data from database
- Logout redirects to login page

---

### Task 1.4: User Profile Management

**Objective:** Allow users to view and update their profile information

**Files to Create:**

#### `/home/superz/next-stock/app/settings/profile/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/settings/profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, store:stores(*)')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-gray-500">Manage your account information</p>
      </div>

      <ProfileForm user={user} profile={profile} />
    </div>
  )
}
```

#### `/home/superz/next-stock/components/settings/profile-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle } from 'lucide-react'

interface ProfileFormProps {
  user: User
  profile: any
}

export function ProfileForm({ user, profile }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Profile updated successfully
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="mt-1 bg-gray-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Email cannot be changed
            </p>
          </div>

          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          {profile?.store && (
            <div>
              <Label>Current Store</Label>
              <Input
                value={profile.store.name}
                disabled
                className="mt-1 bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                Contact administrator to change stores
              </p>
            </div>
          )}

          <div>
            <Label>Role</Label>
            <Input
              value={profile?.role || 'cashier'}
              disabled
              className="mt-1 bg-gray-50 capitalize"
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Testing:**

```bash
# 1. Navigate to /settings/profile
# Expected: Profile form displays with current data

# 2. Update full name
# Expected: Success message appears, changes saved

# 3. Refresh page
# Expected: Updated name persists

# 4. Check navigation user avatar
# Expected: Updated name shows in dropdown
```

✅ **Success Criteria:**
- Profile form displays user information
- Full name can be updated
- Success feedback shows after save
- Email is read-only
- Store and role display correctly

---

## Phase 1 Completion Checklist ✅

- [x] Supabase clients configured (browser, server, middleware)
- [x] Authentication pages implemented (login, signup)
- [x] Protected routes redirect unauthenticated users
- [x] Dashboard layout with navigation functional
- [x] User profile management working
- [x] Session persistence across page reloads
- [x] RLS policies enforced correctly
- [x] Secure redirect-after-authentication flow

**Phase 1 Status:** ✅ COMPLETED (100%)

---

## Phase 2: Core Features (3 weeks) ✅ COMPLETED

**Goals:** Implement product management, categories, and inventory tracking

**Deliverables:**
- ✅ Product CRUD operations (with TanStack Form)
- ✅ Category management
- ✅ Inventory tracking with stock levels
- ✅ Stock movements (entries, exits, adjustments)
- ✅ Search and filtering
- ✅ URL state management with nuqs
- ✅ Product detail pages with statistics
- ✅ Stock movements history
- ✅ Quick actions for products
- ✅ Advanced filters and pagination
- ✅ RLS optimizations and security fixes

**Completion Date:** 2025-11-18
**Status:** ✅ Merged to main via PR #4

---

### Task 2.1: Product CRUD Operations

**Objective:** Create, read, update, delete products with type-safe queries

**Files to Create:**

#### `/home/superz/next-stock/app/products/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { ProductsTable } from '@/components/products/products-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { search?: string; category?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id')
    .eq('id', user!.id)
    .single()

  // Build query with filters
  let query = supabase
    .from('products')
    .select('*, category:categories(name)')
    .eq('store_id', profile!.store_id)
    .order('created_at', { ascending: false })

  if (searchParams.search) {
    query = query.or(
      `name.ilike.%${searchParams.search}%,sku.ilike.%${searchParams.search}%`
    )
  }

  if (searchParams.category) {
    query = query.eq('category_id', searchParams.category)
  }

  const { data: products } = await query

  // Fetch categories for filter
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', profile!.store_id)
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-gray-500">Manage your product inventory</p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      <ProductsTable
        products={products || []}
        categories={categories || []}
      />
    </div>
  )
}
```

#### `/home/superz/next-stock/components/products/products-table.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Product {
  id: string
  name: string
  sku: string
  price: string
  stock_quantity: number
  min_stock_level: number
  category: { name: string } | null
}

interface ProductsTableProps {
  products: Product[]
  categories: any[]
}

export function ProductsTable({ products, categories }: ProductsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    router.push(`/products?${params.toString()}`)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteId)

      if (error) throw error

      router.refresh()
      setDeleteId(null)
    } catch (error) {
      console.error('Failed to delete product:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Products Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category?.name || '-'}</TableCell>
                  <TableCell>${Number(product.price).toFixed(2)}</TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>
                    {product.stock_quantity <= product.min_stock_level ? (
                      <Badge variant="destructive">Low Stock</Badge>
                    ) : (
                      <Badge variant="default" className="bg-green-500">
                        In Stock
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/products/${product.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

#### `/home/superz/next-stock/app/products/new/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { ProductForm } from '@/components/products/product-form'

export default async function NewProductPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id')
    .eq('id', user!.id)
    .single()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', profile!.store_id)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add New Product</h1>
        <p className="text-gray-500">Create a new product in your inventory</p>
      </div>

      <ProductForm
        storeId={profile!.store_id}
        categories={categories || []}
      />
    </div>
  )
}
```

#### `/home/superz/next-stock/components/products/product-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ProductFormProps {
  storeId: string
  categories: any[]
  product?: any
}

export function ProductForm({ storeId, categories, product }: ProductFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category_id: product?.category_id || '',
    price: product?.price || '',
    cost: product?.cost || '',
    stock_quantity: product?.stock_quantity || 0,
    min_stock_level: product?.min_stock_level || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const productData = {
        ...formData,
        store_id: storeId,
        category_id: formData.category_id || null,
        price: parseFloat(formData.price),
        cost: formData.cost ? parseFloat(formData.cost) : null,
        stock_quantity: parseInt(formData.stock_quantity.toString()),
        min_stock_level: parseInt(formData.min_stock_level.toString()),
      }

      if (product) {
        // Update existing product
        const { error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)

        if (updateError) throw updateError
      } else {
        // Create new product
        const { error: insertError } = await supabase
          .from('products')
          .insert(productData)

        if (insertError) throw insertError
      }

      router.push('/products')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to save product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{product ? 'Edit Product' : 'Product Details'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="price">Selling Price *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="cost">Cost Price</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) =>
                  setFormData({ ...formData, cost: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="stock_quantity">Current Stock *</Label>
              <Input
                id="stock_quantity"
                type="number"
                value={formData.stock_quantity}
                onChange={(e) =>
                  setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="min_stock_level">Minimum Stock Level *</Label>
              <Input
                id="min_stock_level"
                type="number"
                value={formData.min_stock_level}
                onChange={(e) =>
                  setFormData({ ...formData, min_stock_level: parseInt(e.target.value) })
                }
                required
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/products')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
```

**Testing:**

```bash
# 1. Navigate to /products
# Expected: Empty products table with "Add Product" button

# 2. Click "Add Product"
# Expected: Form with all fields (name, SKU, price, etc.)

# 3. Submit form with valid data
# Expected: Redirect to /products, new product appears in table

# 4. Click Edit icon on product
# Expected: Form pre-filled with product data

# 5. Update product and save
# Expected: Changes reflected in table

# 6. Click Delete icon
# Expected: Confirmation dialog, product removed after confirm

# 7. Test search functionality
# Expected: Products filtered by name or SKU
```

✅ **Success Criteria:**
- Products list displays with search and filters
- Can create new products with all fields
- Can edit existing products
- Can delete products with confirmation
- Low stock badge shows when stock ≤ minimum
- RLS ensures users only see their store's products

---

### Common Patterns

**Server Component Data Fetching:**
```typescript
// READ: Fetch data in Server Component
const supabase = await createClient()
const { data, error } = await supabase
  .from('products')
  .select('*, category:categories(name)')
  .eq('store_id', storeId)
  .order('created_at', { ascending: false })

// Handle error
if (error) {
  console.error('Database error:', error)
  return <div>Error loading data</div>
}

// Pass to Client Component
return <ProductsTable products={data || []} />
```

**Client Component Mutations:**
```typescript
// CREATE: Insert new record
const supabase = createClient()
const { data, error } = await supabase
  .from('products')
  .insert({
    name: 'Product Name',
    sku: 'SKU-001',
    price: 19.99,
    store_id: storeId,
  })
  .select()
  .single()

// UPDATE: Modify existing record
const { error } = await supabase
  .from('products')
  .update({ price: 24.99 })
  .eq('id', productId)

// DELETE: Remove record
const { error } = await supabase
  .from('products')
  .delete()
  .eq('id', productId)

// Refresh page after mutation
router.refresh()
```

**Type-Safe Queries with Generated Types:**
```typescript
import { Database } from '@/types/supabase'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']

// Use types in components
interface ProductsTableProps {
  products: Product[]
}

// Type-safe insert
const newProduct: ProductInsert = {
  name: 'Product',
  sku: 'SKU-001',
  price: '19.99', // Database schema defines as string
  store_id: storeId,
}
```

**Real-Time Subscriptions:**
```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ProductsList({ initialProducts }) {
  const [products, setProducts] = useState(initialProducts)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to product changes
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return <ProductsTable products={products} />
}
```

---

### Best Practices

**Server Components vs Client Components:**

✅ **Use Server Components When:**
- Fetching data from database
- Accessing environment variables securely
- No interactivity needed (static content)
- SEO important (content rendered on server)

✅ **Use Client Components When:**
- Need useState, useEffect, or event handlers
- Browser-only APIs (localStorage, geolocation)
- Real-time subscriptions
- Form handling with user input

**Example Structure:**
```
page.tsx (Server Component)
  ↓ fetches data
  ↓ passes props
ProductsTable.tsx (Client Component)
  ↓ handles interactions
  ↓ triggers mutations
```

**Data Fetching Strategies:**

1. **Server-Side Rendering (SSR):**
```typescript
// app/products/page.tsx
export default async function ProductsPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('products').select('*')
  return <ProductsTable products={data} />
}
```

2. **Client-Side Fetching with SWR:**
```typescript
'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

export function ProductsList() {
  const fetcher = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('products').select('*')
    return data
  }

  const { data, error, isLoading } = useSWR('products', fetcher, {
    refreshInterval: 5000, // Refresh every 5 seconds
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading products</div>

  return <ProductsTable products={data || []} />
}
```

**State Management:**

1. **Zustand (Global State):**
```typescript
// stores/cart-store.ts
import { create } from 'zustand'

interface CartItem {
  id: string
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (id: string) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (id) =>
    set((state) => ({
      items: [...state.items, { id, quantity: 1 }],
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clearCart: () => set({ items: [] }),
}))

// Usage in component
import { useCartStore } from '@/stores/cart-store'

export function AddToCartButton({ productId }) {
  const addItem = useCartStore((state) => state.addItem)

  return (
    <Button onClick={() => addItem(productId)}>
      Add to Cart
    </Button>
  )
}
```

2. **React Query (Server State):**
```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useProducts(storeId: string) {
  return useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
      return data
    },
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (product: ProductInsert) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate and refetch products
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// Usage
export function ProductForm({ storeId }) {
  const { mutate: createProduct, isPending } = useCreateProduct()

  const handleSubmit = (formData) => {
    createProduct({ ...formData, store_id: storeId })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Product'}
      </Button>
    </form>
  )
}
```

**Performance Optimization:**

1. **Database Indexes:** Already created in schema (see QUICK_START.md)

2. **Pagination:**
```typescript
const ITEMS_PER_PAGE = 20

const { data, count } = await supabase
  .from('products')
  .select('*', { count: 'exact' })
  .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)

const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE)
```

3. **Caching with Next.js:**
```typescript
// Cache for 1 hour
export const revalidate = 3600

// Or use fetch with cache options
const res = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 }
})
```

---

### Troubleshooting

**Auth Issues:**

**Problem:** Session not persisting after login
```typescript
// Solution: Ensure middleware is configured correctly
// Check middleware.ts matcher includes all routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

// Verify cookies are set in browser DevTools → Application → Cookies
// Should see: sb-<project>-auth-token
```

**Problem:** Middleware not firing
```bash
# Verify middleware.ts is at project root
ls -la middleware.ts

# Check Next.js logs for middleware execution
pnpm dev
# Look for "[middleware] Matched /" in logs
```

**Type Generation Issues:**

**Problem:** Types out of sync with database
```bash
# Regenerate types after schema changes
supabase gen types typescript --linked > types/supabase.ts

# Or manually from dashboard
# Settings → API Docs → TypeScript → Copy types
```

**Problem:** Type errors in queries
```typescript
// Issue: Type mismatch on insert
const { error } = await supabase
  .from('products')
  .insert({ price: 19.99 }) // Error: price expects string

// Solution: Match database schema types
const { error } = await supabase
  .from('products')
  .insert({ price: '19.99' }) // price is DECIMAL → string in types
```

**RLS Policy Debugging:**

**Problem:** Queries return empty results
```sql
-- Check if user has profile with store_id
SELECT * FROM profiles WHERE id = auth.uid();

-- Test RLS policy directly
SELECT * FROM products WHERE store_id IN (
  SELECT store_id FROM profiles WHERE id = auth.uid()
);

-- Temporarily disable RLS for testing
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Re-enable after debugging
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

**Problem:** "new row violates row-level security policy"
```typescript
// Ensure store_id is set on insert
const { data: profile } = await supabase
  .from('profiles')
  .select('store_id')
  .eq('id', user.id)
  .single()

if (!profile?.store_id) {
  throw new Error('User has no store assigned')
}

// Include store_id in insert
const { error } = await supabase
  .from('products')
  .insert({
    ...productData,
    store_id: profile.store_id, // Required for RLS
  })
```

**Real-Time Not Working:**

**Problem:** Subscriptions not receiving updates
```typescript
// Check subscription status
const channel = supabase
  .channel('products')
  .on('postgres_changes', { /* config */ }, (payload) => {
    console.log('Change received:', payload)
  })
  .subscribe((status) => {
    console.log('Subscription status:', status)
    // Should log: "SUBSCRIBED"
  })

// Enable real-time in Supabase Dashboard
// Settings → Realtime → Enable for tables
```

**Performance Issues:**

**Problem:** Slow queries (N+1 problem)
```typescript
// Bad: N+1 queries
const products = await supabase.from('products').select('*')
for (const product of products) {
  const category = await supabase
    .from('categories')
    .select('*')
    .eq('id', product.category_id)
    .single()
}

// Good: Join in single query
const { data } = await supabase
  .from('products')
  .select('*, category:categories(*)')
```

**Problem:** Missing database indexes
```sql
-- Check existing indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public';

-- Add index if missing
CREATE INDEX idx_products_store_category
ON products(store_id, category_id);
```

---

## Complete Phase Timeline

**Phase 1: Foundation (Weeks 1-2)**
- Week 1: Tasks 1.1-1.2 (Supabase + Auth)
- Week 2: Tasks 1.3-1.4 (Dashboard + Profile)

**Phase 2: Core Features (Weeks 3-5)**
- Week 3: Task 2.1 (Product CRUD)
- Week 4: Tasks 2.2-2.3 (Categories + Inventory)
- Week 5: Tasks 2.4-2.5 (Stock Movements + Search)

**Phase 3: POS System (Weeks 6-8)**
- Week 6: Tasks 3.1-3.2 (POS UI + Cart)
- Week 7: Tasks 3.3-3.4 (Payment + Receipts)
- Week 8: Task 3.5 (Offline Mode + History)

**Phase 4: Analytics (Weeks 9-10)**
- Week 9: Tasks 4.1-4.2 (Sales + Inventory Reports)
- Week 10: Tasks 4.3-4.5 (Multi-Store + Analytics)

---

## Next Implementation Tasks

Continue with:
- **Task 2.2:** Category Management
- **Task 2.3:** Inventory Tracking
- **Task 2.4:** Stock Movements
- **Task 2.5:** Search and Filtering

Each task follows the same structure:
1. Objective
2. Files to create
3. Complete code examples
4. Testing instructions
5. Success criteria

---

**Support:** For detailed architectural explanations, see [ARCHITECTURE.md](./ARCHITECTURE.md). For setup issues, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).
