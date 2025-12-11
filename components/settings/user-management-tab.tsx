'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MoreHorizontal, Pencil, Trash2, UserCog, Search, Loader2, Plus, RotateCcw, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { UserFormDialog } from './user-form-dialog'
import { deleteUser, restoreUser } from '@/lib/actions/users'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Store = Database['public']['Tables']['stores']['Row']

interface UserWithStores extends Profile {
  user_stores?: {
    id: string
    store_id: string
    is_default: boolean | null
    stores: { id: string; name: string } | null
  }[]
}

interface UserManagementTabProps {
  initialUsers: UserWithStores[]
  stores: Store[]
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  cashier: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

export function UserManagementTab({ initialUsers, stores }: UserManagementTabProps) {
  const t = useTranslations('Settings.users')
  const tAuth = useTranslations('Auth.roles')
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [dialogKey, setDialogKey] = useState(0)
  const [editingUser, setEditingUser] = useState<UserWithStores | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserWithStores | null>(null)
  const [restoringUser, setRestoringUser] = useState<UserWithStores | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === 'all' || user.role === roleFilter

    // Filter deleted users unless showDeleted is enabled
    const matchesDeletedFilter = showDeleted || !user.deleted_at

    return matchesSearch && matchesRole && matchesDeletedFilter
  })

  const handleDelete = async () => {
    if (!deletingUser) return

    startTransition(async () => {
      const result = await deleteUser(deletingUser.id)

      if (result.success) {
        // Update user's deleted_at instead of removing from list
        setUsers((prev) =>
          prev.map((u) =>
            u.id === deletingUser.id ? { ...u, deleted_at: new Date().toISOString() } : u
          )
        )
        toast.success(t('messages.deleted'))
      } else {
        toast.error(result.error || t('errors.deleteFailed'))
      }

      setDeletingUser(null)
    })
  }

  const handleRestore = async () => {
    if (!restoringUser) return

    startTransition(async () => {
      const result = await restoreUser(restoringUser.id)

      if (result.success) {
        // Update user's deleted_at to null
        setUsers((prev) =>
          prev.map((u) =>
            u.id === restoringUser.id ? { ...u, deleted_at: null } : u
          )
        )
        toast.success(t('messages.restored'))
      } else {
        toast.error(result.error || t('errors.restoreFailed'))
      }

      setRestoringUser(null)
    })
  }

  const handleUserUpdated = (updatedUser: UserWithStores) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    )
    setEditingUser(null)
  }

  const handleUserCreated = (newUser: UserWithStores) => {
    setUsers((prev) => [newUser, ...prev])
    setIsAddDialogOpen(false)
  }

  const getAssignedStores = (user: UserWithStores) => {
    if (!user.user_stores || user.user_stores.length === 0) {
      return '-'
    }

    return user.user_stores
      .map((us) => us.stores?.name)
      .filter(Boolean)
      .join(', ')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                {t('title')}
              </CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
            <Button onClick={() => {
              setDialogKey((k) => k + 1)
              setIsAddDialogOpen(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              {t('add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">{tAuth('admin')}</SelectItem>
                <SelectItem value="manager">{tAuth('manager')}</SelectItem>
                <SelectItem value="cashier">{tAuth('cashier')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-deleted"
                checked={showDeleted}
                onCheckedChange={(checked) => setShowDeleted(checked === true)}
              />
              <Label htmlFor="show-deleted" className="text-sm text-muted-foreground cursor-pointer">
                {t('showDeleted')}
              </Label>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('columns.email')}</TableHead>
                  <TableHead>{t('columns.role')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('columns.stores')}</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <p className="text-muted-foreground">
                        {searchQuery || roleFilter !== 'all'
                          ? 'No users found'
                          : 'No users yet'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isDeleted = !!user.deleted_at
                    return (
                      <TableRow key={user.id} className={isDeleted ? 'opacity-60 bg-muted/30' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isDeleted && (
                              <UserX className="h-4 w-4 text-red-500 shrink-0" />
                            )}
                            <div>
                              <div className={`font-medium ${isDeleted ? 'line-through' : ''}`}>
                                {user.full_name || 'Unnamed'}
                              </div>
                              <div className="text-sm text-muted-foreground sm:hidden">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={isDeleted ? 'line-through' : ''}>
                            {user.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={roleColors[user.role]}
                            >
                              {tAuth(user.role as 'admin' | 'manager' | 'cashier')}
                            </Badge>
                            {isDeleted && (
                              <Badge variant="destructive" className="text-xs">
                                {t('status.deleted')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {getAssignedStores(user)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isDeleted ? (
                                <DropdownMenuItem
                                  onClick={() => setRestoringUser(user)}
                                  className="text-green-600"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  {t('restore.action')}
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => setEditingUser(user)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    {t('form.editTitle')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setDeletingUser(user)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('delete.confirm')}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <UserFormDialog
        key={editingUser?.id || `new-${dialogKey}`}
        open={isAddDialogOpen || !!editingUser}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false)
            setEditingUser(null)
          }
        }}
        user={editingUser}
        stores={stores}
        onSuccess={editingUser ? handleUserUpdated : handleUserCreated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPending ? t('delete.deleting') : t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoringUser} onOpenChange={(open) => !open && setRestoringUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('restore.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('restore.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isPending ? t('restore.restoring') : t('restore.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
