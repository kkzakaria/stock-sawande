# Migration vers Franc CFA (XOF)

## Résumé

L'application Next-Stock a été migrée pour utiliser le **Franc CFA (XOF)** comme monnaie par défaut, remplaçant les configurations mixtes USD/MAD.

## Changements effectués

### 1. Configuration centralisée créée
**Fichier**: `lib/config/currency.ts`

```typescript
export const CURRENCY_CONFIG = {
  code: 'XOF',           // Franc CFA de l'Ouest
  locale: 'fr-FR',       // Locale française
  symbol: 'CFA',
  minimumFractionDigits: 0,  // Pas de décimales pour le CFA
  maximumFractionDigits: 0,
}

export function formatCurrency(amount: number): string {
  // Formate les montants en XOF
  // Exemple: 1000 → "1 000 CFA"
}
```

### 2. Fichiers mis à jour (17 fichiers)

**POS (Point de Vente)**:
- `components/pos/cash-session-status.tsx`
- `components/pos/close-session-dialog.tsx`
- `components/pos/manager-approval-dialog.tsx`
- `components/pos/pos-receipt.tsx`

**Ventes**:
- `components/sales/refund-dialog.tsx`
- `components/sales/sale-detail-dialog.tsx`
- `components/sales/sales-data-table.tsx`

**Dashboard & Rapports**:
- `components/dashboard/dashboard-client.tsx`
- `components/dashboard/dashboard-revenue-chart.tsx`
- `components/dashboard/dashboard-top-products.tsx`
- `components/reports/inventory/stock-levels-table.tsx`
- `components/reports/sales/top-products-table.tsx`
- `components/reports/sales/payment-breakdown-chart.tsx`
- `components/reports/performance/cashier-performance-table.tsx`

**Produits & Core**:
- `components/products/products-data-table.tsx`
- `lib/store/cart-store.ts`
- `lib/offline/conflict-resolver.ts`

### 3. Caractéristiques du Franc CFA

- **Pas de décimales**: Les montants sont affichés sans centimes
- **Format français**: Utilise des espaces comme séparateurs de milliers
- **Symbole après le montant**: "CFA" est affiché APRÈS le montant (format correct)
- **Format**: `montant CFA` et NON `CFA montant`

**Exemples de formatage**:
```
1000     → "1 000 CFA"    ✓ (correct)
1500.75  → "1 501 CFA"    ✓ (arrondi automatique)
1000000  → "1 000 000 CFA" ✓ (correct)
2000     → "2 000 CFA"    ✓ (montant avant symbole)

❌ Incorrect: "CFA 2000" (symbole avant le montant)
✓ Correct:   "2 000 CFA" (montant avant symbole)
```

## Pour changer de monnaie

Si vous souhaitez utiliser **XAF** (Franc CFA d'Afrique Centrale) à la place:

1. Ouvrir `lib/config/currency.ts`
2. Changer `code: 'XOF'` par `code: 'XAF'`

Pour une autre monnaie (EUR, USD, etc.):

1. Ouvrir `lib/config/currency.ts`
2. Modifier:
   - `code`: Code ISO 4217 (ex: 'EUR', 'USD')
   - `locale`: Locale appropriée (ex: 'en-US', 'fr-FR')
   - `minimumFractionDigits`: 2 pour EUR/USD (centimes)
   - `maximumFractionDigits`: 2 pour EUR/USD

## Vérification

✅ TypeScript: Aucune erreur de compilation  
✅ Configuration centralisée fonctionnelle  
✅ Tous les composants mis à jour  
✅ Formatage cohérent dans toute l'application

## Support

Le Franc CFA (XOF) est utilisé dans:
- Bénin
- Burkina Faso
- Côte d'Ivoire
- Guinée-Bissau
- Mali
- Niger
- Sénégal
- Togo
