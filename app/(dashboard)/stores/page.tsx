import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Store } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function StoresPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  // Only admins can access stores page
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Get all stores
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stores</h2>
          <p className="text-muted-foreground">
            Manage locations and store settings
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Store
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores?.map((store) => (
          <Card key={store.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {store.name}
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {store.address && (
                  <p className="text-sm text-muted-foreground">
                    {store.address}
                  </p>
                )}
                {store.phone && (
                  <p className="text-sm text-muted-foreground">{store.phone}</p>
                )}
                {store.email && (
                  <p className="text-sm text-muted-foreground">{store.email}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!stores || stores.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              No stores found. Add your first store to get started.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
