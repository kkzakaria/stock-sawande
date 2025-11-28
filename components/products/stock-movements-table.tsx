'use client'

import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { StockMovement, StockMovementType } from '@/lib/actions/stock-movements'

interface StockMovementsTableProps {
  movements: StockMovement[]
  total: number
  currentPage: number
  onPageChange: (page: number) => void
  onTypeFilterChange: (type: StockMovementType | 'all') => void
  currentTypeFilter: StockMovementType | 'all'
}

const MOVEMENT_TYPE_CONFIG: Record<
  StockMovementType,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  purchase: { label: 'Purchase', variant: 'default' },
  sale: { label: 'Sale', variant: 'secondary' },
  adjustment: { label: 'Adjustment', variant: 'outline' },
  transfer: { label: 'Transfer', variant: 'default' },
  return: { label: 'Return', variant: 'secondary' },
  damage: { label: 'Damage', variant: 'destructive' },
  loss: { label: 'Loss', variant: 'destructive' },
}

export function StockMovementsTable({
  movements,
  total,
  currentPage,
  onPageChange,
  onTypeFilterChange,
  currentTypeFilter,
}: StockMovementsTableProps) {
  const itemsPerPage = 10
  const totalPages = Math.ceil(total / itemsPerPage)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter by type:</span>
          <Select
            value={currentTypeFilter}
            onValueChange={(value) =>
              onTypeFilterChange(value as StockMovementType | 'all')
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="return">Return</SelectItem>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="loss">Loss</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {total} {total === 1 ? 'movement' : 'movements'}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No stock movements found
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-sm">
                    {format(new Date(movement.created_at), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={MOVEMENT_TYPE_CONFIG[movement.type].variant}>
                      {MOVEMENT_TYPE_CONFIG[movement.type].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        movement.quantity > 0
                          ? 'font-medium text-green-600'
                          : 'font-medium text-red-600'
                      }
                    >
                      {movement.quantity > 0 ? '+' : ''}
                      {movement.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {movement.previous_quantity}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {movement.new_quantity}
                  </TableCell>
                  <TableCell className="text-sm">
                    {movement.profiles?.full_name || movement.profiles?.email || 'Unknown'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {movement.notes || '-'}
                    {movement.reference && (
                      <span className="ml-1 text-xs">({movement.reference})</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
