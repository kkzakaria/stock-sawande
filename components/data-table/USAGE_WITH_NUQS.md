# DataTable with nuqs Integration

Ce guide explique comment intégrer nuqs avec le composant DataTable pour permettre le partage de liens avec filtres, tri et pagination pré-configurés.

## Installation

nuqs est déjà installé dans le projet. Aucune installation supplémentaire n'est nécessaire.

## Utilisation de base

### 1. Importer le hook

```tsx
import { useDataTableState } from '@/lib/hooks/use-data-table-state';
```

### 2. Utiliser le hook dans votre composant

```tsx
'use client';

import { DataTable } from '@/components/data-table';
import { useDataTableState } from '@/lib/hooks/use-data-table-state';

export function MyDataTableClient({ data, columns }) {
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
    enableVisibilityInUrl: false, // Optionnel
    enablePaginationInUrl: true,
  });

  return (
    <DataTable
      columns={columns}
      data={data}
      // Passer l'état contrôlé au DataTable
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      sorting={sorting}
      onSortingChange={setSorting}
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={setColumnVisibility}
      controlledPagination={pagination}
      onControlledPaginationChange={setPagination}
      // Configuration toolbar
      toolbar={{
        searchKey: "name",
        searchPlaceholder: "Search...",
        filterableColumns: [
          {
            id: "status",
            title: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ],
      }}
    />
  );
}
```

## Exemple complet : Migration de ProductsClient

Voici comment migrer le composant ProductsClient existant pour utiliser nuqs :

### Avant (avec URLSearchParams manuel)

```tsx
'use client';

import { ProductsDataTable } from './products-data-table';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function ProductsClient({ products, pageCount, pageSize }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePaginationChange = useCallback(
    (pageIndex: number, newPageSize: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(pageIndex + 1));
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
      pageCount={pageCount}
      pageSize={pageSize}
      onPaginationChange={handlePaginationChange}
    />
  );
}
```

### Après (avec nuqs - version recommandée)

```tsx
'use client';

import { ProductsDataTable } from './products-data-table';
import { useDataTableState } from '@/lib/hooks/use-data-table-state';
import { useRouter } from 'next/navigation';

export function ProductsClient({ products }) {
  const router = useRouter();

  // Hook nuqs gère automatiquement l'état dans l'URL
  const {
    columnFilters,
    sorting,
    pagination,
    setColumnFilters,
    setSorting,
    setPagination,
  } = useDataTableState({
    defaultPageSize: 10,
  });

  const handleAddProduct = () => {
    router.push('/products/new');
  };

  return (
    <ProductsDataTable
      products={products}
      onAddProduct={handleAddProduct}
      // Passer l'état contrôlé
      columnFilters={columnFilters}
      onColumnFiltersChange={setColumnFilters}
      sorting={sorting}
      onSortingChange={setSorting}
      controlledPagination={pagination}
      onControlledPaginationChange={setPagination}
    />
  );
}
```

### Modifications du ProductsDataTable

Aucune modification nécessaire ! Le composant ProductsDataTable utilise déjà le DataTable qui supporte maintenant les props contrôlées.

## Fonctionnalités

### ✅ Partage de liens

Partagez une URL avec des filtres pré-appliqués :

```
/products?filters=[{"id":"category","value":"Electronics"}]&sorting=[{"id":"price","desc":true}]&pageIndex=2&pageSize=20
```

### ✅ Persistance de l'état

L'état est automatiquement sauvegardé dans l'URL. Rafraîchir la page conserve tous les filtres, tri et pagination.

### ✅ Navigation back/forward

Les boutons précédent/suivant du navigateur fonctionnent correctement avec l'historique des filtres.

### ✅ Backward compatible

Si vous n'utilisez pas les props contrôlées, le DataTable fonctionne comme avant avec son état local interne.

## Options du hook

```tsx
interface DataTableStateOptions {
  /**
   * Taille de page par défaut
   * @default 10
   */
  defaultPageSize?: number;

  /**
   * Synchroniser les filtres de colonnes avec l'URL
   * @default true
   */
  enableFiltersInUrl?: boolean;

  /**
   * Synchroniser le tri avec l'URL
   * @default true
   */
  enableSortingInUrl?: boolean;

  /**
   * Synchroniser la visibilité des colonnes avec l'URL
   * @default false
   */
  enableVisibilityInUrl?: boolean;

  /**
   * Synchroniser la pagination avec l'URL
   * @default true
   */
  enablePaginationInUrl?: boolean;
}
```

## Fonctions utilitaires

Le hook retourne également des fonctions utilitaires :

```tsx
const { resetState, resetFilters } = useDataTableState();

// Réinitialiser tous les états (filtres, tri, pagination)
resetState();

// Réinitialiser uniquement les filtres (+ retour page 1)
resetFilters();
```

## Utilisation avec serveur-side

Pour la pagination côté serveur, combinez nuqs avec les Server Components :

```tsx
// app/products/page.tsx (Server Component)
interface PageProps {
  searchParams: {
    filters?: string;
    sorting?: string;
    pageIndex?: string;
    pageSize?: string;
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  // Parser les paramètres
  const filters = searchParams.filters ? JSON.parse(searchParams.filters) : [];
  const sorting = searchParams.sorting ? JSON.parse(searchParams.sorting) : [];
  const pageIndex = parseInt(searchParams.pageIndex || '0');
  const pageSize = parseInt(searchParams.pageSize || '10');

  // Fetch data avec les filtres
  const { products, totalCount } = await getProducts({
    filters,
    sorting,
    pageIndex,
    pageSize,
  });

  return (
    <ProductsClient
      products={products}
      totalCount={totalCount}
    />
  );
}
```

## Avantages de nuqs vs URLSearchParams manuel

| Feature | URLSearchParams manuel | nuqs |
|---------|------------------------|------|
| Type safety | ❌ | ✅ |
| Serialization automatique | ❌ | ✅ |
| Parsing automatique | ❌ | ✅ |
| Shallow routing | ❌ | ✅ |
| Code verbeux | ✅ | ❌ |
| Hook réutilisable | ❌ | ✅ |

## Troubleshooting

### Les filtres ne s'appliquent pas

Vérifiez que vous avez bien passé les props contrôlées au DataTable :

```tsx
<DataTable
  columnFilters={columnFilters}  // ✅
  onColumnFiltersChange={setColumnFilters}  // ✅
  // ...
/>
```

### L'URL devient trop longue

Pour des tableaux complexes avec beaucoup de filtres, envisagez de désactiver certaines options :

```tsx
useDataTableState({
  enableVisibilityInUrl: false,  // Ne pas inclure visibility dans URL
});
```

### Conflit avec pagination serveur existante

Si vous utilisez déjà `manualPagination` et `onPaginationChange`, vous pouvez continuer à les utiliser. Les props contrôlées sont optionnelles et backward compatible.

## Ressources

- [nuqs Documentation](https://nuqs.47ng.com/)
- [TanStack Table Documentation](https://tanstack.com/table/latest)
