'use client';

import { ProductsTable } from './products-table';
import { ProductsFilters } from './products-filters';
import { ProductsPagination } from './products-pagination';
import { useProductFilters } from '@/lib/hooks/use-product-filters';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  quantity: number;
  min_stock_level: number | null;
  is_active: boolean | null;
  barcode: string | null;
  categories: { id: string; name: string } | null;
  stores: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface ProductsClientProps {
  products: Product[];
  categories: Category[];
  stores: Store[];
  totalCount: number;
}

export function ProductsClient({
  products,
  categories,
  stores,
  totalCount,
}: ProductsClientProps) {
  const { filters } = useProductFilters();

  const totalPages = Math.ceil(totalCount / filters.limit);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ProductsFilters categories={categories} stores={stores} />

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {products.length} of {totalCount} products
      </div>

      {/* Products Table */}
      <ProductsTable products={products} />

      {/* Pagination */}
      {totalPages > 1 && (
        <ProductsPagination
          currentPage={filters.page}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}
