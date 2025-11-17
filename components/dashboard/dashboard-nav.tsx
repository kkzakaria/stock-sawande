'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Store,
} from 'lucide-react'

interface DashboardNavProps {
  profile: any
}

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    title: 'Products',
    href: '/products',
    icon: Package,
    roles: ['admin', 'manager'],
  },
  {
    title: 'Sales',
    href: '/sales',
    icon: ShoppingCart,
    roles: ['admin', 'manager'],
  },
  {
    title: 'POS',
    href: '/pos',
    icon: CreditCard,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager'],
  },
  {
    title: 'Stores',
    href: '/stores',
    icon: Store,
    roles: ['admin'],
  },
]

export function DashboardNav({ profile }: DashboardNavProps) {
  const pathname = usePathname()
  const userRole = profile?.role || 'cashier'

  // Filter nav items based on user role
  const allowedItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <aside className="w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <Package className="h-6 w-6" />
          <span className="text-lg">Next Stock</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 p-4">
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
              {item.title}
            </Link>
          )
        })}
      </nav>

      {/* Store info */}
      {profile?.stores && (
        <div className="absolute bottom-0 w-64 border-t p-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Current Store</p>
            <p className="font-medium">{profile.stores.name}</p>
          </div>
        </div>
      )}
    </aside>
  )
}
