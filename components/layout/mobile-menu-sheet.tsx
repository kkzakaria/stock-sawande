'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut } from 'lucide-react'
import { navItems, type Profile, type NavTranslations } from '@/components/dashboard/dashboard-nav'
import { createClient } from '@/lib/supabase/client'

interface MobileMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile | null
  translations: NavTranslations
}

export function MobileMenuSheet({
  open,
  onOpenChange,
  profile,
  translations,
}: MobileMenuSheetProps) {
  const pathname = usePathname()
  const router = useRouter()
  const userRole = profile?.role || 'cashier'

  // Filter nav items based on user role
  const allowedItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  )

  // Check if current path matches (accounting for locale prefix)
  const isActivePath = (href: string) => {
    return pathname?.endsWith(href) || pathname === href
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    onOpenChange(false)
    router.push('/login')
    router.refresh()
  }

  const handleNavigation = () => {
    onOpenChange(false)
  }

  // Get user initials
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <SheetTitle className="text-left">
                {profile?.full_name || 'User'}
              </SheetTitle>
              <span className="text-sm text-muted-foreground">
                {profile?.email}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {profile?.role}
              </span>
            </div>
          </div>
        </SheetHeader>

        <nav className="flex flex-col gap-1 py-4 overflow-y-auto">
          {allowedItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavigation}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-base transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {translations[item.titleKey as keyof NavTranslations]}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background pb-[env(safe-area-inset-bottom)]">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {translations.logout || 'Logout'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
