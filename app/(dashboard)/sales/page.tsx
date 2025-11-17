import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Sales</h2>
        <p className="text-muted-foreground">
          View and manage all sales transactions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sales management will be implemented in Phase 4
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
