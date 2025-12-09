'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserProfileTab } from './user-profile-tab'
import { CategoriesTab } from './categories-tab'
import { UserManagementTab } from './user-management-tab'
import { BusinessSettingsTab } from './business-settings-tab'
import { User, UserCog, Tags, Settings2 } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type Store = Database['public']['Tables']['stores']['Row']

interface UserWithStores extends Profile {
  user_stores?: {
    id: string
    store_id: string
    is_default: boolean | null
    stores: { id: string; name: string } | null
  }[]
}

interface BusinessSettings {
  tax_rate: {
    rate: number
    enabled: boolean
  }
  currency: {
    code: string
    locale: string
    symbol: string
    fractionDigits?: number
  }
  stock_alerts: {
    defaultThreshold: number
    enabled: boolean
  }
}

interface SettingsTabsProps {
  userRole: 'admin' | 'manager' | 'cashier'
  profile: Profile
  users?: UserWithStores[]
  categories?: Category[]
  stores?: Store[]
  businessSettings?: BusinessSettings
}

export function SettingsTabs({
  userRole,
  profile,
  users,
  categories,
  stores,
  businessSettings,
}: SettingsTabsProps) {
  const t = useTranslations('Settings')

  const isAdmin = userRole === 'admin'
  const isManager = ['admin', 'manager'].includes(userRole)

  const tabs = useMemo(() => {
    const availableTabs = []

    // Profile tab - available to all users
    availableTabs.push({
      value: 'profile',
      label: t('tabs.profile'),
      icon: User,
    })

    // Categories tab - admin and manager
    if (isManager) {
      availableTabs.push({
        value: 'categories',
        label: t('tabs.categories'),
        icon: Tags,
      })
    }

    // User Management tab - admin only
    if (isAdmin) {
      availableTabs.push({
        value: 'users',
        label: t('tabs.users'),
        icon: UserCog,
      })
    }

    // Business Settings tab - admin only
    if (isAdmin) {
      availableTabs.push({
        value: 'business',
        label: t('tabs.business'),
        icon: Settings2,
      })
    }

    return availableTabs
  }, [isAdmin, isManager, t])

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex lg:grid-cols-none">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <UserProfileTab profile={profile} />
      </TabsContent>

      {isManager && (
        <TabsContent value="categories" className="space-y-6">
          <CategoriesTab initialCategories={categories || []} />
        </TabsContent>
      )}

      {isAdmin && (
        <TabsContent value="users" className="space-y-6">
          <UserManagementTab
            initialUsers={users || []}
            stores={stores || []}
          />
        </TabsContent>
      )}

      {isAdmin && (
        <TabsContent value="business" className="space-y-6">
          <BusinessSettingsTab initialSettings={businessSettings} />
        </TabsContent>
      )}
    </Tabs>
  )
}
