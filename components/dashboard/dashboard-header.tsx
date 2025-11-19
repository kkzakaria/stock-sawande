'use client'

import { User } from '@supabase/supabase-js'
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
import { LogOut, Settings, User as UserIcon, RefreshCw } from 'lucide-react'
import { logout } from '@/app/(auth)/actions'
import { refreshUserSession } from '@/lib/actions/session'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, startRefresh] = useTransition()
  const router = useRouter()

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

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: 'Admin',
      manager: 'Manager',
      cashier: 'Cashier',
    }
    return badges[role as keyof typeof badges] || role
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-6 flex-shrink-0">
      <div>
        <h1 className="text-lg font-semibold">
          {profile?.stores ? profile.stores.name : 'Next Stock'}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* User role badge */}
        <div className="hidden md:flex flex-col items-end">
          <p className="text-sm font-medium">{profile?.full_name || user.email}</p>
          <p className="text-xs text-muted-foreground">
            {getRoleBadge(profile?.role || '')}
          </p>
        </div>

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
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleRefreshSession}
              disabled={isRefreshing || isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Session'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} disabled={isPending || isRefreshing}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{isPending ? 'Logging out...' : 'Log out'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
