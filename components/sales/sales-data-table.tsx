'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Eye, RotateCcw, Receipt, CreditCard, Banknote, Smartphone } from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useTranslations, useLocale } from 'next-intl'
import { DataTable } from '@/components/data-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SaleWithDetails } from '@/lib/actions/sales'
import { SaleDetailDialog } from './sale-detail-dialog'
import { RefundDialog } from './refund-dialog'

interface SalesDataTableProps {
  sales: SaleWithDetails[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function SalesDataTable({
  sales,
  isLoading = false,
  onRefresh,
}: SalesDataTableProps) {
  const t = useTranslations('Sales')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const dateLocale = locale === 'fr' ? fr : enUS

  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)

  const handleViewDetail = (sale: SaleWithDetails) => {
    setSelectedSale(sale)
    setDetailDialogOpen(true)
  }

  const handleRefund = (sale: SaleWithDetails) => {
    setSelectedSale(sale)
    setRefundDialogOpen(true)
  }

  const handleRefundSuccess = () => {
    setRefundDialogOpen(false)
    setSelectedSale(null)
    if (onRefresh) {
      onRefresh()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600">{t('status.completed')}</Badge>
      case 'refunded':
        return <Badge variant="destructive">{t('status.refunded')}</Badge>
      case 'pending':
        return <Badge variant="secondary">{t('status.pending')}</Badge>
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
        return t('paymentMethods.cash')
      case 'card':
        return t('paymentMethods.card')
      case 'mobile':
        return t('paymentMethods.mobile')
      default:
        return t('paymentMethods.other')
    }
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const columns: ColumnDef<SaleWithDetails>[] = [
    {
      accessorKey: 'sale_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.invoice')} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue('sale_number')}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.date')} />
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue('created_at'))
        return (
          <div className="flex flex-col">
            <span className="text-sm">
              {format(date, 'dd MMM yyyy', { locale: dateLocale })}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(date, 'HH:mm')}
            </span>
          </div>
        )
      },
    },
    {
      id: 'cashier',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.cashier')} />
      ),
      cell: ({ row }) => {
        const cashier = row.original.cashier
        return (
          <span className="text-sm">
            {cashier?.full_name || cashier?.email || t('detail.notAvailable')}
          </span>
        )
      },
    },
    {
      id: 'customer',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.customer')} />
      ),
      cell: ({ row }) => {
        const customer = row.original.customer
        return (
          <span className="text-sm text-muted-foreground">
            {customer?.name || t('customer.walkIn')}
          </span>
        )
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.total')} />
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.getValue('total'))}
        </span>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.payment')} />
      ),
      cell: ({ row }) => {
        const method = row.getValue('payment_method') as string
        return (
          <div className="flex items-center gap-2">
            {getPaymentMethodIcon(method)}
            <span className="text-sm">{getPaymentMethodLabel(method)}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.status')} />
      ),
      cell: ({ row }) => getStatusBadge(row.getValue('status')),
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const sale = row.original

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{tCommon('actions')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tCommon('actions')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewDetail(sale)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('actions.viewDetail')}
              </DropdownMenuItem>
              {sale.status === 'completed' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleRefund(sale)}
                    className="text-destructive"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('actions.refund')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={sales}
        isLoading={isLoading}
        toolbar={{
          searchKey: 'sale_number',
          searchPlaceholder: t('searchPlaceholder'),
          filterableColumns: [
            {
              id: 'status',
              title: t('columns.status'),
              options: [
                { label: t('status.completed'), value: 'completed' },
                { label: t('status.refunded'), value: 'refunded' },
                { label: t('status.pending'), value: 'pending' },
              ],
            },
            {
              id: 'payment_method',
              title: t('columns.payment'),
              options: [
                { label: t('paymentMethods.cash'), value: 'cash' },
                { label: t('paymentMethods.card'), value: 'card' },
                { label: t('paymentMethods.mobile'), value: 'mobile' },
                { label: t('paymentMethods.other'), value: 'other' },
              ],
            },
          ],
          enableExport: true,
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        emptyMessage={t('empty')}
      />

      {/* Sale Detail Dialog */}
      <SaleDetailDialog
        sale={selectedSale}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onRefund={() => {
          setDetailDialogOpen(false)
          if (selectedSale) {
            handleRefund(selectedSale)
          }
        }}
      />

      {/* Refund Dialog */}
      <RefundDialog
        sale={selectedSale}
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        onSuccess={handleRefundSuccess}
      />
    </>
  )
}
