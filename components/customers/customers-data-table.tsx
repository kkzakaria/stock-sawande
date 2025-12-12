'use client'

import { useState, useTransition } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Trash2, Mail, Phone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CURRENCY_CONFIG } from '@/lib/config/currency'
import { DataTable } from '@/components/data-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteCustomer } from '@/lib/actions/customers'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EditCustomerDialog } from './edit-customer-dialog'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  total_purchases: number | null
  total_spent: number | null
  created_at: string
  updated_at: string
}

interface CustomersDataTableProps {
  customers: Customer[]
  onAddCustomer?: () => void
  userRole: string
}

export function CustomersDataTable({
  customers,
  onAddCustomer,
  userRole,
}: CustomersDataTableProps) {
  const t = useTranslations('Customers')
  const tCommon = useTranslations('Common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)

  const canEdit = ['admin', 'manager'].includes(userRole)
  const canDelete = ['admin', 'manager'].includes(userRole)

  const handleDelete = async () => {
    if (!customerToDelete) return

    startTransition(async () => {
      const result = await deleteCustomer(customerToDelete)
      if (result.success) {
        setDeleteDialogOpen(false)
        setCustomerToDelete(null)
        toast.success(t('messages.deleted'))
        router.refresh()
      } else {
        toast.error(result.error || t('errors.deleteFailed'))
      }
    })
  }

  const confirmDelete = (id: string) => {
    setCustomerToDelete(id)
    setDeleteDialogOpen(true)
  }

  const openEditDialog = (customer: Customer) => {
    setCustomerToEdit(customer)
    setEditDialogOpen(true)
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-'
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} ${CURRENCY_CONFIG.symbol}`
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString))
  }

  const canManage = canEdit || canDelete

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.name')} />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('name')}</span>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.email')} />
      ),
      cell: ({ row }) => {
        const email = row.getValue('email') as string | null
        if (!email) return <span className="text-muted-foreground">-</span>
        return (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{email}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.phone')} />
      ),
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string | null
        if (!phone) return <span className="text-muted-foreground">-</span>
        return (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{phone}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'total_purchases',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.totalPurchases')} />
      ),
      cell: ({ row }) => {
        const purchases = row.getValue('total_purchases') as number | null
        return <span>{purchases ?? 0}</span>
      },
    },
    {
      accessorKey: 'total_spent',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.totalSpent')} />
      ),
      cell: ({ row }) => {
        const spent = row.getValue('total_spent') as number | null
        return <span className="font-medium">{formatCurrency(spent)}</span>
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.createdAt')} />
      ),
      cell: ({ row }) => {
        const date = row.getValue('created_at') as string
        return <span className="text-muted-foreground">{formatDate(date)}</span>
      },
    },
    // Only show actions column if user can edit or delete
    ...(canManage
      ? [
          {
            id: 'actions',
            cell: ({ row }: { row: { original: Customer } }) => {
              const customer = row.original

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
                    {canEdit && (
                      <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t('actions.edit')}
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => confirmDelete(customer.id)}
                          className="text-destructive"
                          disabled={isPending}
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
          } as ColumnDef<Customer>,
        ]
      : []),
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={customers}
        enableRowSelection
        toolbar={{
          searchKey: 'name',
          searchPlaceholder: t('searchPlaceholder'),
          onAdd: onAddCustomer,
          addLabel: t('addCustomer'),
          enableExport: true,
        }}
        pageSize={10}
        pageSizeOptions={[10, 20, 50, 100]}
        emptyMessage={t('empty')}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? t('delete.deleting') : t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditCustomerDialog
        customer={customerToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  )
}
