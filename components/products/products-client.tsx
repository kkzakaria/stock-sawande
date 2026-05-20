'use client';

import { ProductsDataTable } from './products-data-table';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import {
  columnFiltersParser,
  sortingStateParser,
  pageIndexParser,
  pageSizeParser
} from '@/lib/url-state-parsers';
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table';

interface Product {
  template_id: string | null;
  sku: string | null;
  name: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  price: number | null;
  min_price: number | null;
  max_price: number | null;
  cost: number | null;
  quantity: number | null;
  min_stock_level: number | null;
  is_active: boolean | null;
  barcode: string | null;
  image_url: string | null;
  // Optional fields (present in per-store view, absent in aggregated view)
  inventory_id?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  // Aggregated view fields
  store_count?: number | null;
  total_quantity?: number | null;
  // Manager/cashier specific: my store's quantity
  my_quantity?: number | null;
}

interface ProductsClientProps {
  products: Product[];
  userRole?: string | null;
  totalCount: number;
  pageCount: number;
  allCategories: Array<{ id: string; name: string }>;
}

export function ProductsClient({
  products,
  userRole,
  totalCount,
  pageCount,
  allCategories,
}: ProductsClientProps) {
  const router = useRouter();

  // Read URL state for initial values only — the data table writes back.
  const [urlState] = useQueryStates({
    filters: columnFiltersParser,
    sorting: sortingStateParser,
    pageIndex: pageIndexParser,
    pageSize: pageSizeParser.withDefault(10),
  });

  const handleAddProduct = () => {
    router.push('/products/new');
  };

  return (
    <ProductsDataTable
      products={products}
      onAddProduct={handleAddProduct}
      userRole={userRole}
      totalCount={totalCount}
      pageCount={pageCount}
      allCategories={allCategories}
      // Pass URL state as initial values (uncontrolled mode)
      initialColumnFilters={urlState.filters as ColumnFiltersState ?? []}
      initialSorting={urlState.sorting as SortingState ?? []}
      initialPagination={{
        pageIndex: urlState.pageIndex ?? 0,
        pageSize: urlState.pageSize ?? 10,
      }}
    />
  );
}
