import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function POSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Point of Sale</h2>
        <p className="text-muted-foreground">
          Process sales and manage transactions
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Product catalog will be displayed here
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Cart</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Shopping cart will be displayed here
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            POS interface will be implemented in Phase 5
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
