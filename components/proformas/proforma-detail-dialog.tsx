'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useLocale, useTranslations } from 'next-intl'
import {
  Loader2,
  FileText,
  ShoppingCart,
  Store,
  User,
  Calendar,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
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
import { getProformaDetail, type ProformaWithDetails, type ProformaItemWithProduct } from '@/lib/actions/proformas'

interface ProformaDetailDialogProps {
  proforma: ProformaWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConvert?: () => void
}

export function ProformaDetailDialog({
  proforma,
  open,
  onOpenChange,
  onConvert,
}: ProformaDetailDialogProps) {
  const t = useTranslations('Proformas')
  const locale = useLocale()
  const dateLocale = locale === 'fr' ? fr : enUS

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ProformaItemWithProduct[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchItems() {
      if (!proforma || !open) return

      setLoading(true)
      setError(null)

      const result = await getProformaDetail(proforma.id)

      if (result.success && result.data) {
        setItems(result.data.items)
      } else {
        setError(result.error || 'Failed to load proforma details')
      }

      setLoading(false)
    }

    fetchItems()
  }, [proforma, open])

  if (!proforma) return null

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">{t('status.draft')}</Badge>
      case 'sent':
        return <Badge className="bg-blue-500 hover:bg-blue-600">{t('status.sent')}</Badge>
      case 'accepted':
        return <Badge className="bg-green-500 hover:bg-green-600">{t('status.accepted')}</Badge>
      case 'rejected':
        return <Badge variant="destructive">{t('status.rejected')}</Badge>
      case 'converted':
        return <Badge className="bg-purple-500 hover:bg-purple-600">{t('status.converted')}</Badge>
      case 'expired':
        return <Badge variant="outline" className="text-orange-600 border-orange-600">{t('status.expired')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const canConvert = ['draft', 'sent', 'accepted'].includes(proforma.status)
  const isExpired = proforma.valid_until && new Date(proforma.valid_until) < new Date()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('detail.title')}
          </DialogTitle>
          <DialogDescription>
            {t('detail.number')}: {proforma.proforma_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Proforma Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                {t('detail.number')}
              </div>
              <p className="font-mono font-medium">{proforma.proforma_number}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {t('detail.createdAt')}
              </div>
              <p className="font-medium">
                {format(new Date(proforma.created_at), "dd MMM yyyy 'at' HH:mm", { locale: dateLocale })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Store className="h-4 w-4" />
                {t('detail.store')}
              </div>
              <p className="font-medium">{proforma.store?.name || 'N/A'}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {t('detail.createdBy')}
              </div>
              <p className="font-medium">
                {proforma.created_by?.full_name || proforma.created_by?.email || 'N/A'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {t('detail.validUntil')}
              </div>
              <p className={`font-medium ${isExpired ? 'text-red-500' : ''}`}>
                {proforma.valid_until
                  ? format(new Date(proforma.valid_until), 'dd MMM yyyy', { locale: dateLocale })
                  : t('detail.noExpiry')}
                {isExpired && <span className="ml-2 text-xs">({t('status.expired')})</span>}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">{t('columns.status')}</div>
              <div>{getStatusBadge(proforma.status)}</div>
            </div>

            {proforma.customer && (
              <div className="space-y-1 col-span-2">
                <div className="text-sm text-muted-foreground">{t('detail.customer')}</div>
                <div>
                  <p className="font-medium">{proforma.customer.name}</p>
                  {proforma.customer.email && (
                    <p className="text-sm text-muted-foreground">{proforma.customer.email}</p>
                  )}
                  {proforma.customer.phone && (
                    <p className="text-sm text-muted-foreground">{proforma.customer.phone}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Status History */}
          {(proforma.sent_at || proforma.accepted_at || proforma.rejected_at || proforma.converted_at) && (
            <>
              <div>
                <h4 className="font-medium mb-3">{t('detail.statusHistory')}</h4>
                <div className="space-y-2">
                  {proforma.sent_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>{t('statusHistory.sent')}: {format(new Date(proforma.sent_at), "dd MMM yyyy 'at' HH:mm", { locale: dateLocale })}</span>
                    </div>
                  )}
                  {proforma.accepted_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{t('statusHistory.accepted')}: {format(new Date(proforma.accepted_at), "dd MMM yyyy 'at' HH:mm", { locale: dateLocale })}</span>
                    </div>
                  )}
                  {proforma.rejected_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{t('statusHistory.rejected')}: {format(new Date(proforma.rejected_at), "dd MMM yyyy 'at' HH:mm", { locale: dateLocale })}</span>
                    </div>
                  )}
                  {proforma.converted_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <ShoppingCart className="h-4 w-4 text-purple-500" />
                      <span>{t('statusHistory.converted')}: {format(new Date(proforma.converted_at), "dd MMM yyyy 'at' HH:mm", { locale: dateLocale })}</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Items Table */}
          <div>
            <h4 className="font-medium mb-3">{t('detail.items')}</h4>
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
                {t('detail.noItems')}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('itemColumns.product')}</TableHead>
                      <TableHead className="text-right">{t('itemColumns.qty')}</TableHead>
                      <TableHead className="text-right">{t('itemColumns.unitPrice')}</TableHead>
                      <TableHead className="text-right">{t('itemColumns.discount')}</TableHead>
                      <TableHead className="text-right">{t('itemColumns.subtotal')}</TableHead>
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
              <span className="text-muted-foreground">{t('totals.subtotal')}</span>
              <span>{formatCurrency(proforma.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('totals.tax')}</span>
              <span>{formatCurrency(proforma.tax)}</span>
            </div>
            {proforma.discount && proforma.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{t('totals.discount')}</span>
                <span>-{formatCurrency(proforma.discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-medium text-lg">
              <span>{t('totals.total')}</span>
              <span>{formatCurrency(proforma.total)}</span>
            </div>
          </div>

          {/* Rejection Info */}
          {proforma.status === 'rejected' && proforma.rejection_reason && (
            <>
              <Separator />
              <div className="rounded-md bg-destructive/10 p-4">
                <h4 className="font-medium text-destructive mb-2">{t('rejection.title')}</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>{t('rejection.reason')}:</strong> {proforma.rejection_reason}
                </p>
              </div>
            </>
          )}

          {/* Terms */}
          {proforma.terms && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">{t('detail.terms')}</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{proforma.terms}</p>
              </div>
            </>
          )}

          {/* Notes */}
          {proforma.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">{t('detail.notes')}</h4>
                <p className="text-sm text-muted-foreground">{proforma.notes}</p>
              </div>
            </>
          )}

          {/* Expiry Warning */}
          {isExpired && proforma.status !== 'converted' && (
            <>
              <Separator />
              <div className="rounded-md bg-orange-50 dark:bg-orange-950 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-700 dark:text-orange-300">{t('expiry.title')}</h4>
                  <p className="text-sm text-orange-600 dark:text-orange-400">{t('expiry.message')}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.close')}
          </Button>
          {canConvert && onConvert && (
            <Button onClick={onConvert}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              {t('actions.convertToSale')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
