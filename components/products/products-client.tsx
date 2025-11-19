'use client';

import { ProductsDataTable } from './products-data-table';
import { useRouter } from 'next/navigation';
import { useDataTableState } from '@/lib/hooks/use-data-table-state';

interface Product {
  template_id: string | null;
  inventory_id: string | null;
  sku: string | null;
  name: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  price: number | null;
  cost: number | null;
  quantity: number | null;
  min_stock_level: number | null;
  is_active: boolean | null;
  barcode: string | null;
  image_url: string | null;
  store_id: string | null;
  store_name: string | null;
}

interface ProductsClientProps {
  products: Product[];
}

export function ProductsClient({ products }: ProductsClientProps) {
  const router = useRouter();

  // Use nuqs hook for URL-based state management
  const {
    columnFilters,
    sorting,
    columnVisibility,
    pagination,
    setColumnFilters,
    setSorting,
    setColumnVisibility,
    setPagination,
  } = useDataTableState({
    defaultPageSize: 10,
    enableFiltersInUrl: true,
    enableSortingInUrl: true,
    enableVisibilityInUrl: false,
    enablePaginationInUrl: true,
  });

  const handleAddProduct = () => {
    router.push('/products/new');
  };

  return (
    <ProductsDataTable
      products={products}
      onAddProduct={handleAddProduct}
      // Pass controlled state to DataTable
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      sorting={sorting}
      onSortingChange={setSorting}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      controlledPagination={pagination}
      onControlledPaginationChange={setPagination}
    />
  );
}
