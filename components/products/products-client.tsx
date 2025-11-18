'use client';

import { ProductsDataTable } from './products-data-table';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

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
  pageCount: number;
  pageSize: number;
}

export function ProductsClient({
  products,
  pageCount,
  pageSize,
}: ProductsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleAddProduct = () => {
    router.push('/products/new');
  };

  const handlePaginationChange = useCallback(
    (pageIndex: number, newPageSize: number) => {
      const params = new URLSearchParams(searchParams.toString());

      // Update page (TanStack uses 0-based index, convert to 1-based for URL)
      params.set('page', String(pageIndex + 1));

      // Update limit if it changed
      if (newPageSize !== pageSize) {
        params.set('limit', String(newPageSize));
      }

      router.push(`/products?${params.toString()}`);
    },
    [router, searchParams, pageSize]
  );

  return (
    <ProductsDataTable
      products={products}
      onAddProduct={handleAddProduct}
      pageCount={pageCount}
      pageSize={pageSize}
      onPaginationChange={handlePaginationChange}
    />
  );
}
