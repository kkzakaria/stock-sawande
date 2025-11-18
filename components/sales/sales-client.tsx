'use client';

import { SalesFilters } from './sales-filters';
import { SalesPagination } from './sales-pagination';
import { useSaleFilters } from '@/lib/hooks/use-sale-filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Store {
  id: string;
  name: string;
}

interface SalesClientProps {
  stores: Store[];
}

export function SalesClient({ stores }: SalesClientProps) {
  const { filters } = useSaleFilters();

  // Placeholder for when sales data is implemented
  const totalCount = 0;
  const sales: unknown[] = [];
  const totalPages = Math.ceil(totalCount / filters.limit);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <SalesFilters stores={stores} />

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {sales.length} of {totalCount} sales
      </div>

      {/* Placeholder for Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sales management will be implemented in Phase 4. The filtering system is ready and will work once sales data is available.
          </p>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>Current filters:</p>
            <ul className="list-disc list-inside space-y-1">
              {filters.search && <li>Search: {filters.search}</li>}
              {filters.status && <li>Status: {filters.status}</li>}
              {filters.store && <li>Store: {filters.store}</li>}
              {filters.dateFrom && <li>From: {filters.dateFrom.toLocaleDateString()}</li>}
              {filters.dateTo && <li>To: {filters.dateTo.toLocaleDateString()}</li>}
              <li>Sort: {filters.sortBy} ({filters.sortOrder})</li>
              <li>Page: {filters.page} (showing {filters.limit} per page)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <SalesPagination currentPage={filters.page} totalPages={totalPages} />
      )}
    </div>
  );
}
