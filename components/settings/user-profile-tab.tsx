'use client'

import { ProfileForm } from './profile-form'
import { LanguageSettings } from './language-settings'
import { PinSettings } from './pin-settings'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface UserProfileTabProps {
  profile: Profile
}

export function UserProfileTab({ profile }: UserProfileTabProps) {
  const canHavePin = ['manager', 'admin'].includes(profile.role)

  return (
    <div className="space-y-6">
      {/* Profile Form */}
      <ProfileForm
        initialData={{
          full_name: profile.full_name || '',
          avatar_url: profile.avatar_url || '',
          email: profile.email,
        }}
      />

      {/* Language Settings */}
      <LanguageSettings currentLanguage={profile.preferred_language || 'fr'} />

      {/* PIN Settings - Only for managers/admins */}
      {canHavePin && <PinSettings userRole={profile.role} />}
    </div>
  )
}
