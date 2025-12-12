'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Copy,
  Printer
} from 'lucide-react'
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
import type { ProformaWithDetails } from '@/lib/actions/proformas'
import { ProformaDetailDialog } from './proforma-detail-dialog'
import { ConvertToSaleDialog } from './convert-to-sale-dialog'
import { UpdateStatusDialog } from './update-status-dialog'
import { DeleteProformaDialog } from './delete-proforma-dialog'
import { ProformaPrint } from './proforma-print'

interface ProformasDataTableProps {
  proformas: ProformaWithDetails[]
  isLoading?: boolean
  onRefresh?: () => void
  userRole: 'admin' | 'manager' | 'cashier'
}

export function ProformasDataTable({
  proformas,
  isLoading = false,
  onRefresh,
  userRole,
}: ProformasDataTableProps) {
  const t = useTranslations('Proformas')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const dateLocale = locale === 'fr' ? fr : enUS

  const [selectedProforma, setSelectedProforma] = useState<ProformaWithDetails | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [statusAction, setStatusAction] = useState<'sent' | 'accepted' | 'rejected'>('sent')

  const handleViewDetail = (proforma: ProformaWithDetails) => {
    setSelectedProforma(proforma)
    setDetailDialogOpen(true)
  }

  const handleConvert = (proforma: ProformaWithDetails) => {
    setSelectedProforma(proforma)
    setConvertDialogOpen(true)
  }

  const handleStatusChange = (proforma: ProformaWithDetails, action: 'sent' | 'accepted' | 'rejected') => {
    setSelectedProforma(proforma)
    setStatusAction(action)
    setStatusDialogOpen(true)
  }

  const handleDelete = (proforma: ProformaWithDetails) => {
    setSelectedProforma(proforma)
    setDeleteDialogOpen(true)
  }

  const handlePrint = (proforma: ProformaWithDetails) => {
    setSelectedProforma(proforma)
    setPrintDialogOpen(true)
  }

  const handleSuccess = () => {
    setConvertDialogOpen(false)
    setStatusDialogOpen(false)
    setDeleteDialogOpen(false)
    setSelectedProforma(null)
    if (onRefresh) {
      onRefresh()
    }
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

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const columns: ColumnDef<ProformaWithDetails>[] = [
    {
      accessorKey: 'proforma_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.number')} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.getValue('proforma_number')}
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
      id: 'customer',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.customer')} />
      ),
      cell: ({ row }) => {
        const customer = row.original.customer
        return (
          <div className="flex flex-col">
            <span className="text-sm">
              {customer?.name || t('customer.notSpecified')}
            </span>
            {customer?.phone && (
              <span className="text-xs text-muted-foreground">
                {customer.phone}
              </span>
            )}
          </div>
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
      accessorKey: 'valid_until',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.validUntil')} />
      ),
      cell: ({ row }) => {
        const validUntil = row.getValue('valid_until') as string | null
        if (!validUntil) {
          return <span className="text-sm text-muted-foreground">-</span>
        }
        const date = new Date(validUntil)
        const isExpired = date < new Date()
        return (
          <span className={`text-sm ${isExpired ? 'text-red-500' : ''}`}>
            {format(date, 'dd MMM yyyy', { locale: dateLocale })}
          </span>
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
        const proforma = row.original
        const canEdit = ['draft', 'sent'].includes(proforma.status)
        const canSend = proforma.status === 'draft'
        const canAcceptReject = proforma.status === 'sent'
        const canConvert = ['draft', 'sent', 'accepted'].includes(proforma.status)
        // Only admin and manager can delete proformas
        const canDelete = proforma.status !== 'converted' && ['admin', 'manager'].includes(userRole)

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

              <DropdownMenuItem onClick={() => handleViewDetail(proforma)}>
                <Eye className="mr-2 h-4 w-4" />
                {t('actions.view')}
              </DropdownMenuItem>

              {canEdit && (
                <DropdownMenuItem asChild>
                  <a href={`/proformas/${proforma.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t('actions.edit')}
                  </a>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {canSend && (
                <DropdownMenuItem onClick={() => handleStatusChange(proforma, 'sent')}>
                  <Send className="mr-2 h-4 w-4" />
                  {t('actions.send')}
                </DropdownMenuItem>
              )}

              {canAcceptReject && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusChange(proforma, 'accepted')}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    {t('actions.accept')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(proforma, 'rejected')}>
                    <XCircle className="mr-2 h-4 w-4 text-red-600" />
                    {t('actions.reject')}
                  </DropdownMenuItem>
                </>
              )}

              {canConvert && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleConvert(proforma)}>
                    <ShoppingCart className="mr-2 h-4 w-4 text-purple-600" />
                    {t('actions.convertToSale')}
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => handlePrint(proforma)}>
                <Printer className="mr-2 h-4 w-4" />
                {t('actions.print')}
              </DropdownMenuItem>

              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                {t('actions.duplicate')}
              </DropdownMenuItem>

              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(proforma)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('actions.delete')}
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
        data={proformas}
        isLoading={isLoading}
        toolbar={{
          searchKey: 'proforma_number',
          searchPlaceholder: t('searchPlaceholder'),
          filterableColumns: [
            {
              id: 'status',
              title: t('columns.status'),
              options: [
                { label: t('status.draft'), value: 'draft' },
                { label: t('status.sent'), value: 'sent' },
                { label: t('status.accepted'), value: 'accepted' },
                { label: t('status.rejected'), value: 'rejected' },
                { label: t('status.converted'), value: 'converted' },
                { label: t('status.expired'), value: 'expired' },
              ],
            },
          ],
          enableExport: true,
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        emptyMessage={t('empty')}
      />

      {/* Proforma Detail Dialog */}
      <ProformaDetailDialog
        proforma={selectedProforma}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onConvert={() => {
          setDetailDialogOpen(false)
          if (selectedProforma) {
            handleConvert(selectedProforma)
          }
        }}
      />

      {/* Convert to Sale Dialog */}
      <ConvertToSaleDialog
        proforma={selectedProforma}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onSuccess={handleSuccess}
      />

      {/* Update Status Dialog */}
      <UpdateStatusDialog
        proforma={selectedProforma}
        action={statusAction}
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        onSuccess={handleSuccess}
      />

      {/* Delete Dialog */}
      <DeleteProformaDialog
        proforma={selectedProforma}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={handleSuccess}
      />

      {/* Print Dialog */}
      <ProformaPrint
        proforma={selectedProforma}
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
      />
    </>
  )
}
