import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, ShoppingCart, TrendingUp, Users } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, stores(*)')
    .eq('id', user!.id)
    .single()

  // Placeholder stats - will be populated with real data later
  const stats = [
    {
      title: 'Total Products',
      value: '0',
      icon: Package,
      description: 'Products in inventory',
    },
    {
      title: 'Today Sales',
      value: '$0',
      icon: ShoppingCart,
      description: 'Sales today',
    },
    {
      title: 'Revenue',
      value: '$0',
      icon: TrendingUp,
      description: 'Total revenue',
    },
    {
      title: 'Active Users',
      value: '1',
      icon: Users,
      description: 'Team members',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back, {profile?.full_name || user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Quick action buttons will be added here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
