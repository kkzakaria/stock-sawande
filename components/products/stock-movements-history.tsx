'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StockMovementsTable } from './stock-movements-table'
import { getStockMovements, type StockMovementType } from '@/lib/actions/stock-movements'
import type { StockMovement } from '@/lib/actions/stock-movements'

interface StockMovementsHistoryProps {
  productId: string
}

export function StockMovementsHistory({ productId }: StockMovementsHistoryProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMovements() {
      setLoading(true)
      const result = await getStockMovements(productId, {
        type: typeFilter === 'all' ? undefined : typeFilter,
        page: currentPage,
        limit: 10,
      })

      if (result.success && result.data) {
        setMovements(result.data.movements)
        setTotal(result.data.total)
      }
      setLoading(false)
    }

    loadMovements()
  }, [productId, currentPage, typeFilter])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleTypeFilterChange = (type: StockMovementType | 'all') => {
    setTypeFilter(type)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Movement History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading...
          </div>
        ) : (
          <StockMovementsTable
            movements={movements}
            total={total}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onTypeFilterChange={handleTypeFilterChange}
            currentTypeFilter={typeFilter}
          />
        )}
      </CardContent>
    </Card>
  )
}
