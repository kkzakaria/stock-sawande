'use client'

import { useState, useTransition } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Pencil, Trash2, Mail, Phone, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
import { deleteStore } from '@/lib/actions/stores'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EditStoreDialog } from './edit-store-dialog'

interface Store {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

interface StoresDataTableProps {
  stores: Store[]
  onAddStore?: () => void
}

export function StoresDataTable({ stores, onAddStore }: StoresDataTableProps) {
  const t = useTranslations('Stores')
  const tCommon = useTranslations('Common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null)

  const handleDelete = async () => {
    if (!storeToDelete) return

    startTransition(async () => {
      const result = await deleteStore(storeToDelete)
      if (result.success) {
        setDeleteDialogOpen(false)
        setStoreToDelete(null)
        toast.success(t('messages.deleted'))
        router.refresh()
      } else {
        toast.error(result.error || t('errors.deleteFailed'))
      }
    })
  }

  const confirmDelete = (id: string) => {
    setStoreToDelete(id)
    setDeleteDialogOpen(true)
  }

  const openEditDialog = (store: Store) => {
    setStoreToEdit(store)
    setEditDialogOpen(true)
  }

  const columns: ColumnDef<Store>[] = [
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
      accessorKey: 'address',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('columns.address')} />
      ),
      cell: ({ row }) => {
        const address = row.getValue('address') as string | null
        if (!address) return <span className="text-muted-foreground">-</span>
        return (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate max-w-[200px]">{address}</span>
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
      id: 'actions',
      cell: ({ row }) => {
        const store = row.original

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
              <DropdownMenuItem onClick={() => openEditDialog(store)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => confirmDelete(store.id)}
                className="text-destructive"
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('actions.delete')}
              </DropdownMenuItem>
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
        data={stores}
        enableRowSelection
        toolbar={{
          searchKey: 'name',
          searchPlaceholder: t('searchPlaceholder'),
          onAdd: onAddStore,
          addLabel: t('addStore'),
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

      <EditStoreDialog
        store={storeToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  )
}
