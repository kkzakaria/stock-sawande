# nuqs URL State Management

Ce projet utilise [nuqs](https://nuqs.47ng.com/) pour gérer l'état dans les paramètres d'URL (URL state management) à travers toutes les pages du dashboard.

## Avantages

- **URLs partageables**: Les utilisateurs peuvent partager des liens avec des filtres pré-appliqués
- **Navigation browser**: Les boutons back/forward du navigateur fonctionnent avec les filtres
- **Deep linking**: Liens directs vers des états filtrés spécifiques
- **SEO-friendly**: Rendu côté serveur (SSR) avec les paramètres d'URL
- **Type-safe**: Parsers typés avec TypeScript pour garantir la sécurité des types
- **Performance**: Shallow routing, pas de rechargement complet de page

## Architecture

### Structure des fichiers

```
lib/
├── url-state-parsers.ts          # Parsers réutilisables (page, limit, search, etc.)
├── types/filters.ts               # Types TypeScript pour tous les filtres
└── hooks/
    ├── use-product-filters.ts     # Hook pour Products
    ├── use-sale-filters.ts        # Hook pour Sales
    ├── use-report-filters.ts      # Hook pour Reports
    └── use-store-filters.ts       # Hook pour Stores

components/
├── products/
│   ├── products-client.tsx        # Composant client principal
│   ├── products-filters.tsx       # Contrôles de filtrage
│   └── products-pagination.tsx    # Pagination
├── sales/
│   ├── sales-client.tsx
│   ├── sales-filters.tsx
│   └── sales-pagination.tsx
├── reports/
│   ├── reports-client.tsx
│   └── reports-filters.tsx
└── stores/
    ├── stores-client.tsx
    └── stores-filters.tsx

app/
└── (dashboard)/
    ├── products/page.tsx          # Server Component avec searchParams
    ├── sales/page.tsx
    ├── reports/page.tsx
    └── stores/page.tsx
```

### Pattern Server/Client

Chaque page suit le pattern hybride Server + Client Component :

1. **Server Component** (page.tsx):
   - Accepte `searchParams` de Next.js
   - Parse les paramètres en filtres typés
   - Fetch les données avec les filtres
   - Passe les données au Client Component

2. **Client Component** (*-client.tsx):
   - Utilise le hook nuqs correspondant
   - Affiche les filtres interactifs
   - Affiche les données
   - Gère la pagination

## Schéma des URL Parameters

### Products (`/products`)

| Paramètre | Type | Valeurs possibles | Default | Description |
|-----------|------|-------------------|---------|-------------|
| `search` | string | any | `''` | Recherche par nom ou SKU |
| `category` | string | UUID | `null` | Filtre par catégorie |
| `status` | enum | `active`, `inactive` | `null` | Filtre par statut |
| `store` | string | UUID | `null` | Filtre par magasin (admin uniquement) |
| `sortBy` | enum | `name`, `sku`, `price`, `quantity`, `created_at` | `created_at` | Colonne de tri |
| `sortOrder` | enum | `asc`, `desc` | `asc` | Ordre de tri |
| `page` | integer | >= 1 | `1` | Numéro de page |
| `limit` | integer | `10`, `25`, `50`, `100` | `10` | Items par page |

**Exemples d'URLs**:
```
/products?search=laptop
/products?category=electronics&status=active
/products?sortBy=price&sortOrder=desc&limit=25
/products?search=SKU-123&page=2&limit=50
```

### Sales (`/sales`)

| Paramètre | Type | Valeurs possibles | Default | Description |
|-----------|------|-------------------|---------|-------------|
| `search` | string | any | `''` | Recherche par numéro de facture |
| `status` | enum | `completed`, `refunded`, `pending` | `null` | Filtre par statut |
| `store` | string | UUID | `null` | Filtre par magasin |
| `dateFrom` | ISO datetime | ISO 8601 | `null` | Date de début |
| `dateTo` | ISO datetime | ISO 8601 | `null` | Date de fin |
| `sortBy` | enum | `created_at`, `total_amount`, `invoice_number` | `created_at` | Colonne de tri |
| `sortOrder` | enum | `asc`, `desc` | `asc` | Ordre de tri |
| `page` | integer | >= 1 | `1` | Numéro de page |
| `limit` | integer | `10`, `25`, `50`, `100` | `10` | Items par page |

**Exemples d'URLs**:
```
/sales?status=completed&dateFrom=2025-01-01
/sales?store=store-uuid&dateFrom=2025-01-01&dateTo=2025-01-31
/sales?sortBy=total_amount&sortOrder=desc
```

### Reports (`/reports`)

| Paramètre | Type | Valeurs possibles | Default | Description |
|-----------|------|-------------------|---------|-------------|
| `reportType` | enum | `sales`, `inventory`, `performance` | `sales` | Type de rapport |
| `store` | string | UUID | `null` | Filtre par magasin |
| `dateFrom` | ISO datetime | ISO 8601 | `null` | Date de début |
| `dateTo` | ISO datetime | ISO 8601 | `null` | Date de fin |
| `groupBy` | enum | `daily`, `weekly`, `monthly` | `daily` | Groupement des données |

**Exemples d'URLs**:
```
/reports?reportType=sales&groupBy=weekly
/reports?reportType=inventory&dateFrom=2025-01-01&groupBy=monthly
/reports?reportType=performance&store=store-uuid
```

### Stores (`/stores`)

| Paramètre | Type | Valeurs possibles | Default | Description |
|-----------|------|-------------------|---------|-------------|
| `search` | string | any | `''` | Recherche par nom de magasin |
| `status` | enum | `active`, `inactive` | `null` | Filtre par statut |

**Exemples d'URLs**:
```
/stores?search=downtown
/stores?status=active
```

## Usage dans le code

### Utiliser un hook de filtres

```tsx
'use client';

import { useProductFilters } from '@/lib/hooks/use-product-filters';

export function ProductsClient({ products }) {
  const { filters, setFilters, resetFilters } = useProductFilters();

  // Lire les valeurs actuelles
  console.log(filters.search);  // string
  console.log(filters.page);    // number

  // Mettre à jour un seul filtre
  const handleSearchChange = (value: string) => {
    setFilters({ search: value });
  };

  // Mettre à jour plusieurs filtres
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters({ sortBy, sortOrder });
  };

  // Réinitialiser tous les filtres
  const handleReset = () => {
    resetFilters();
  };

  return (
    <div>
      {/* Votre UI */}
    </div>
  );
}
```

### Parser les searchParams (Server Component)

```tsx
import type { ProductFilters } from '@/lib/types/filters';

interface ProductsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  const filters: ProductFilters = {
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? parseInt(params.page, 10) : 1,
    // ... autres filtres
  };

  // Fetch data avec les filtres
  const { data } = await getProducts(filters);

  return <ProductsClient products={data} />;
}
```

## Parsers disponibles

Dans `lib/url-state-parsers.ts` :

- `pageParser` - Pagination (integer >= 1, default: 1)
- `limitParser` - Items par page (integer, default: 10)
- `sortOrderParser` - Ordre de tri (`asc` | `desc`, default: `asc`)
- `searchParser` - Recherche (string, default: `''`)
- `statusParser` - Statut (string nullable)
- `dateFromParser` / `dateToParser` - Dates (ISO datetime)
- `idParser` - ID numériques (integer)
- `createEnumParser` - Créer un parser d'enum personnalisé

## Bonnes pratiques

### 1. Toujours utiliser les hooks fournis

❌ **Mauvais**:
```tsx
const [search, setSearch] = useQueryState('search');
```

✅ **Bon**:
```tsx
const { filters, setFilters } = useProductFilters();
```

### 2. Réinitialiser la pagination quand les filtres changent

Le helper `setFilterWithResetPage` le fait automatiquement :

```tsx
const { setFilterWithResetPage } = useProductFilters();

// Reset automatique de la page à 1
setFilterWithResetPage('search', 'laptop');
```

### 3. Debounce les inputs de recherche

```tsx
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback((value: string) => {
  setFilterWithResetPage('search', value);
}, 300);

<Input onChange={(e) => debouncedSearch(e.target.value)} />
```

### 4. Utiliser les types fournis

Tous les types de filtres sont définis dans `lib/types/filters.ts` :

```tsx
import type { ProductFilters, SaleFilters } from '@/lib/types/filters';
```

## Compatibilité Next.js 16

Ce projet utilise :
- Next.js 16.0.3 avec App Router
- React 19.2.0
- nuqs 2.8.0 avec l'adaptateur Next.js App Router

Le `NuqsAdapter` est configuré dans `app/layout.tsx` pour tous les composants enfants.

## Débogage

### Voir les paramètres actuels

```tsx
const { filters } = useProductFilters();
console.log('Current filters:', filters);
```

### Vérifier l'URL

Tous les filtres sont visibles dans l'URL du navigateur :
```
http://localhost:3000/products?search=laptop&status=active&page=2
```

### Tester le SSR

Les paramètres d'URL sont disponibles côté serveur :

```tsx
export default async function ProductsPage({ searchParams }) {
  const params = await searchParams;
  console.log('Server-side params:', params);
  // ...
}
```

## Migration future

Pour ajouter nuqs à une nouvelle page :

1. Créer le hook dans `lib/hooks/use-{page}-filters.ts`
2. Définir les types dans `lib/types/filters.ts`
3. Créer les composants client avec filtres
4. Modifier la page pour accepter `searchParams`
5. Parser et fetch les données avec les filtres

## Ressources

- [nuqs Documentation](https://nuqs.47ng.com/)
- [nuqs avec Next.js App Router](https://nuqs.47ng.com/docs/adapters/next-pages)
- [Next.js searchParams](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)
