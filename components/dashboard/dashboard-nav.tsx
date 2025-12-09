'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Store,
  Settings,
} from 'lucide-react'

interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: string
  store_id: string | null
  stores?: { name: string } | null
}

interface NavTranslations {
  dashboard: string
  products: string
  sales: string
  pos: string
  reports: string
  stores: string
  settings: string
}

interface DashboardNavProps {
  profile: Profile | null
  translations: NavTranslations
}

const navItems = [
  {
    titleKey: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    titleKey: 'products',
    href: '/products',
    icon: Package,
    roles: ['admin', 'manager'],
  },
  {
    titleKey: 'sales',
    href: '/sales',
    icon: ShoppingCart,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    titleKey: 'pos',
    href: '/pos',
    icon: CreditCard,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    titleKey: 'reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager'],
  },
  {
    titleKey: 'stores',
    href: '/stores',
    icon: Store,
    roles: ['admin'],
  },
  {
    titleKey: 'settings',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'manager'],
  },
]

export function DashboardNav({ profile, translations }: DashboardNavProps) {
  const pathname = usePathname()
  const userRole = profile?.role || 'cashier'

  // Filter nav items based on user role
  const allowedItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  // Check if current path matches (accounting for locale prefix)
  const isActivePath = (href: string) => {
    // pathname includes locale prefix like /fr/dashboard or /en/dashboard
    return pathname?.endsWith(href) || pathname === href
  }

  return (
    <aside className="w-[200px] border-r bg-card flex flex-col h-screen">
      <div className="flex h-16 items-center justify-center border-b flex-shrink-0">
        <Link href="/dashboard">
          <Image
            src="/qgk-logo.png"
            alt="QGK Logo"
            width={48}
            height={48}
          />
        </Link>
      </div>

      <nav className="flex flex-col gap-1 p-4 flex-1 overflow-y-auto">
        {allowedItems.map((item) => {
          const Icon = item.icon
          const isActive = isActivePath(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {translations[item.titleKey as keyof NavTranslations]}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
