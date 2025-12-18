'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CreditCard,
  ShoppingCart,
  FileText,
  MoreHorizontal,
} from 'lucide-react'
import type { Profile, NavTranslations } from '@/components/dashboard/dashboard-nav'
import { MobileMenuSheet } from './mobile-menu-sheet'

interface BottomNavProps {
  profile: Profile | null
  translations: NavTranslations
}

const bottomNavItems = [
  {
    titleKey: 'dashboard' as const,
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    titleKey: 'pos' as const,
    href: '/pos',
    icon: CreditCard,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    titleKey: 'sales' as const,
    href: '/sales',
    icon: ShoppingCart,
    roles: ['admin', 'manager', 'cashier'],
  },
  {
    titleKey: 'proformas' as const,
    href: '/proformas',
    icon: FileText,
    roles: ['admin', 'manager', 'cashier'],
  },
]

export function BottomNav({ profile, translations }: BottomNavProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const userRole = profile?.role || 'cashier'

  // Filter nav items based on user role
  const allowedItems = bottomNavItems.filter((item) =>
    item.roles.includes(userRole)
  )

  // Check if current path matches (accounting for locale prefix)
  const isActivePath = (href: string) => {
    return pathname?.endsWith(href) || pathname === href
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
        <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
          {allowedItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className="truncate">
                  {translations[item.titleKey]}
                </span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMenuOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors',
              menuOpen ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>{translations.more || 'Plus'}</span>
          </button>
        </div>
      </nav>

      <MobileMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        profile={profile}
        translations={translations}
      />
    </>
  )
}
