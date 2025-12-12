'use client'

import { useState, useTransition } from 'react'
import { User } from '@supabase/supabase-js'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LogOut, User as UserIcon, RefreshCw } from 'lucide-react'
import { logout } from '@/app/[locale]/(auth)/actions'
import { refreshUserSession } from '@/lib/actions/session'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { ProfileDialog } from './profile-dialog'

interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: string
  store_id: string | null
  avatar_url?: string | null
  stores?: { name: string } | null
}

interface DashboardHeaderProps {
  user: User
  profile: Profile | null
}

export function DashboardHeader({ user, profile }: DashboardHeaderProps) {
  const t = useTranslations('Auth')
  const tCommon = useTranslations('Common')
  const tProfile = useTranslations('ProfileDialog')
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, startRefresh] = useTransition()
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)

  const handleLogout = () => {
    startTransition(async () => {
      await logout()
    })
  }

  const handleRefreshSession = () => {
    startRefresh(async () => {
      await refreshUserSession()
      // Force logout to clear cached session
      await logout()
    })
  }

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-6 flex-shrink-0">
      <div>
        <h1 className="text-lg font-semibold">
          {profile?.stores ? profile.stores.name : 'Next Stock'}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Language Switcher */}
        <LocaleSwitcher className="hidden md:flex" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar>
                <AvatarImage
                  src={profile?.avatar_url || undefined}
                  alt={profile?.full_name || user.email || 'User'}
                />
                <AvatarFallback>
                  {getInitials(profile?.full_name, user.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>{tProfile('tabs.profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleRefreshSession}
              disabled={isRefreshing || isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? tCommon('refreshing') : tCommon('refresh')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} disabled={isPending || isRefreshing}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{isPending ? t('loggingOut') : t('logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Profile Dialog */}
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        initialData={{
          full_name: profile?.full_name || '',
          avatar_url: profile?.avatar_url || '',
          email: user.email || '',
        }}
        userRole={profile?.role || 'cashier'}
      />
    </header>
  )
}
