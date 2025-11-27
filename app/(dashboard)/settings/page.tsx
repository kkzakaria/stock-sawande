import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PinSettings } from '@/components/settings/pin-settings'
import { Settings } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, store_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">
            Gérez vos préférences et paramètres de compte
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* PIN Settings - Only for managers and admins */}
        <PinSettings userRole={profile.role} />
      </div>
    </div>
  )
}
