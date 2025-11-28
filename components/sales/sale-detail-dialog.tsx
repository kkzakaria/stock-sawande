'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Loader2, RotateCcw, Receipt, CreditCard, Banknote, Smartphone, Store, User, Calendar, Hash } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getSaleDetail, type SaleWithDetails, type SaleItemWithProduct } from '@/lib/actions/sales'

interface SaleDetailDialogProps {
  sale: SaleWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefund?: () => void
}

export function SaleDetailDialog({
  sale,
  open,
  onOpenChange,
  onRefund,
}: SaleDetailDialogProps) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SaleItemWithProduct[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch sale items when dialog opens
  useEffect(() => {
    async function fetchItems() {
      if (!sale || !open) return

      setLoading(true)
      setError(null)

      const result = await getSaleDetail(sale.id)

      if (result.success && result.data) {
        setItems(result.data.items)
      } else {
        setError(result.error || 'Failed to load sale details')
      }

      setLoading(false)
    }

    fetchItems()
  }, [sale, open])

  // Reset state when dialog opens (not closes, to avoid cascade renders)
  // Items will be fetched fresh each time dialog opens

  if (!sale) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>
      case 'refunded':
        return <Badge variant="destructive">Refunded</Badge>
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-4 w-4 text-green-600" />
      case 'card':
        return <CreditCard className="h-4 w-4 text-blue-600" />
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-purple-600" />
      default:
        return <Receipt className="h-4 w-4 text-gray-600" />
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Cash'
      case 'card':
        return 'Card'
      case 'mobile':
        return 'Mobile Payment'
      default:
        return 'Other'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Sale Details
          </DialogTitle>
          <DialogDescription>
            Invoice #{sale.sale_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Sale Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                Invoice Number
              </div>
              <p className="font-mono font-medium">{sale.sale_number}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Date
              </div>
              <p className="font-medium">
                {format(new Date(sale.created_at), "dd MMM yyyy 'at' HH:mm", { locale: fr })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4" />
                Store
              </div>
              <p className="font-medium">{sale.store?.name || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Cashier
              </div>
              <p className="font-medium">
                {sale.cashier?.full_name || sale.cashier?.email || 'N/A'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {getPaymentMethodIcon(sale.payment_method)}
                Payment Method
              </div>
              <p className="font-medium">{getPaymentMethodLabel(sale.payment_method)}</p>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Status</div>
              <div>{getStatusBadge(sale.status)}</div>
            </div>

            {sale.customer && (
              <div className="space-y-1 col-span-2">
                <div className="text-sm text-muted-foreground">Customer</div>
                <p className="font-medium">{sale.customer.name}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Items Table */}
          <div>
            <h4 className="font-medium mb-3">Items</h4>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product?.name || 'Unknown Product'}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.product?.sku || '-'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.discount ? formatCurrency(item.discount) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(sale.tax)}</span>
            </div>
            {sale.discount && sale.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-medium text-lg">
              <span>Total</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {/* Refund Info */}
          {sale.status === 'refunded' && sale.refund_reason && (
            <>
              <Separator />
              <div className="rounded-md bg-destructive/10 p-4">
                <h4 className="font-medium text-destructive mb-2">Refund Information</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>Reason:</strong> {sale.refund_reason}
                </p>
                {sale.refunded_at && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>Date:</strong>{' '}
                    {format(new Date(sale.refunded_at), "dd MMM yyyy 'at' HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {sale.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground">{sale.notes}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {sale.status === 'completed' && onRefund && (
            <Button variant="destructive" onClick={onRefund}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Refund Sale
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
