'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoriesTab } from './categories-tab'
import { UserManagementTab } from './user-management-tab'
import { BusinessSettingsTab } from './business-settings-tab'
import { IntegrationsTab } from './integrations-tab'
import { UserCog, Tags, Settings2, Plug } from 'lucide-react'
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
  company_info: {
    name: string
    taxId: string
    address: string
    phone: string
    email: string
    website: string
    logoUrl: string
  }
}

interface IntegrationsSettings {
  email: {
    enabled: boolean
    apiKey: string
    fromEmail: string
    fromName: string
  }
  whatsapp: {
    enabled: boolean
    phoneNumberId: string
    accessToken: string
    businessAccountId: string
    webhookVerifyToken: string
  }
}

interface SettingsTabsProps {
  userRole: 'admin' | 'manager' | 'cashier'
  users?: UserWithStores[]
  categories?: Category[]
  stores?: Store[]
  businessSettings?: BusinessSettings
  integrationsSettings?: IntegrationsSettings
}

export function SettingsTabs({
  userRole,
  users,
  categories,
  stores,
  businessSettings,
  integrationsSettings,
}: SettingsTabsProps) {
  const t = useTranslations('Settings')

  const isAdmin = userRole === 'admin'
  const isManager = ['admin', 'manager'].includes(userRole)

  const tabs = useMemo(() => {
    const availableTabs = []

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

    // Integrations tab - admin only
    if (isAdmin) {
      availableTabs.push({
        value: 'integrations',
        label: t('tabs.integrations'),
        icon: Plug,
      })
    }

    return availableTabs
  }, [isAdmin, isManager, t])

  const defaultTab = tabs[0]?.value || 'categories'

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
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

      {isAdmin && (
        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsTab initialSettings={integrationsSettings} />
        </TabsContent>
      )}
    </Tabs>
  )
}
