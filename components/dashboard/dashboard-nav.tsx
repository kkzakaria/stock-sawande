'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/src/i18n/navigation'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Store,
} from 'lucide-react'

interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: string
  store_id: string | null
  stores?: { name: string } | null
}

interface DashboardNavProps {
  profile: Profile | null
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
]

export function DashboardNav({ profile }: DashboardNavProps) {
  const pathname = usePathname()
  const t = useTranslations('Navigation')
  const userRole = profile?.role || 'cashier'

  // Filter nav items based on user role
  const allowedItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

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
          const isActive = pathname === item.href

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
              {t(item.titleKey)}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
