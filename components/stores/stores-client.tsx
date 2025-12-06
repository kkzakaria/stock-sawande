'use client';

import { Store } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StoresFilters } from './stores-filters';
import { useStoreFilters } from '@/lib/hooks/use-store-filters';
import { useTranslations } from 'next-intl';

interface StoreData {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean | null;
}

interface StoresClientProps {
  stores: StoreData[];
}

export function StoresClient({ stores }: StoresClientProps) {
  const { filters } = useStoreFilters();
  const t = useTranslations('Stores');

  // Apply client-side filtering
  const filteredStores = stores.filter((store) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        store.name.toLowerCase().includes(searchLower) ||
        store.address?.toLowerCase().includes(searchLower) ||
        store.email?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.status === 'active' && !store.is_active) return false;
    if (filters.status === 'inactive' && store.is_active) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <StoresFilters />

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {t('showing', { filtered: filteredStores.length, total: stores.length })}
      </div>

      {/* Stores Grid */}
      {filteredStores.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStores.map((store) => (
            <Card key={store.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{store.name}</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {store.address && (
                    <p className="text-sm text-muted-foreground">{store.address}</p>
                  )}
                  {store.phone && (
                    <p className="text-sm text-muted-foreground">{store.phone}</p>
                  )}
                  {store.email && (
                    <p className="text-sm text-muted-foreground">{store.email}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              {t('noResults')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
