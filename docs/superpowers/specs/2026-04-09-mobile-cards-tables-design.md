# Mobile Cards for Data Tables — Design

**Date:** 2026-04-09
**Status:** Approved (brainstorming)
**Scope:** Replace horizontally-scrolling tables with card layouts on mobile (<md) for all 5 feature tables: products, sales, customers, stores, proformas.

## Context & Problem

The generic `DataTable` (`components/data-table/data-table.tsx`) uses `whitespace-nowrap` on every cell and relies on horizontal scroll. On mobile (<768px):

- Toolbar (`data-table-toolbar.tsx`) uses `flex justify-between` with no wrapping → Add/Import/Export/View buttons overflow.
- Pagination (`data-table-pagination.tsx`) uses `space-x-6 lg:space-x-8` → overflows on narrow screens.
- Even with horizontal scroll, scanning a table on a 375px screen is poor UX (users lose column context).

The 5 feature tables (`components/{products,sales,customers,stores,proformas}/*-data-table.tsx`) all inherit the same issue.

## Goals

- Native, scannable mobile layout for each table.
- Zero breaking change to the desktop table UX.
- Single source of truth for filters, sort, pagination, selection across both modes.
- Opt-in at the feature level — tables without a `mobileCard` config keep the current scroll behavior during migration.

## Non-Goals

- Unit tests (none exist in repo today).
- Infinite scroll or "load more" — pagination stays numeric.
- Touch-specific gestures beyond long-press (no swipe-to-delete).
- Mobile-only bulk export; bulk operations on mobile limited to what makes sense with long-press selection.

## Architecture

### Responsive strategy

Single `DataTable` component renders both trees side-by-side, visibility driven by CSS:

- `<md` → `DataTableMobileList` + `DataTableMobileToolbar` + `DataTableMobilePagination`
- `≥md` → existing `<table>` + `DataTableToolbar` + `DataTablePagination` (unchanged)

Visibility via Tailwind (`hidden md:block` / `md:hidden`). No `useMediaQuery` — avoids hydration flash.

One `useReactTable` instance pilots both: filtering, sorting, pagination, row selection are shared. Switching viewports (e.g. orientation) preserves state.

### New `DataTable` props

```ts
type MobileCardConfig<TData> = (row: Row<TData>) => {
  title: ReactNode
  subtitle?: ReactNode
  rightValue?: ReactNode
  badge?: { label: ReactNode; variant?: "default" | "success" | "warning" | "danger" }
  thumbnail?: ReactNode
  onClick?: () => void
  menuItems?: Array<{ label: string; icon?: LucideIcon; onClick: () => void; variant?: "default" | "destructive" }>
}

type BulkAction<TData> = {
  label: string
  icon?: LucideIcon
  onClick: (rows: TData[]) => void
  variant?: "default" | "destructive"
}

// DataTableProps additions
mobileCard?: MobileCardConfig<TData>
bulkActions?: BulkAction<TData>[]
```

`mobileCard` is optional: tables that don't provide it fall back to the current `<table>` scroll on mobile (no breaking change mid-migration).

`bulkActions` is useful on desktop too (future reuse) but primarily consumed by the mobile selection-mode action bar.

### New components (all under `components/data-table/`)

**`data-table-card.tsx` — `DataTableCard`**
- Generic card, consumes `MobileCardConfig` output.
- Slots: `thumbnail` (44×44, rounded), `title`, `subtitle` (`line-clamp-1`, muted), `rightValue` (`tabular-nums`), `badge` (variant-colored).
- `⋮` button top-right → `DropdownMenu` populated from `menuItems` (hidden in selection mode).
- Card is a `<button>` with focus-visible ring; calls `onClick` on tap (ignored in selection mode — tap toggles selection instead).
- `touch-action: manipulation` to avoid double-tap delay.
- Long-press (pointerdown→500ms, cancel on >10px move or pointerup) → activates selection mode and selects the pressed row.
- Optional `navigator.vibrate?.(20)` haptic on long-press activation.

**`data-table-mobile-list.tsx` — `DataTableMobileList`**
- Receives the TanStack `table` instance + `mobileCard` + `bulkActions` + `emptyMessage`.
- Owns local state `selectionMode: boolean`.
- Maps `table.getRowModel().rows` to `<DataTableCard>`.
- States:
  - **Loading:** 3 shadcn `Skeleton` cards with same structure.
  - **Empty:** centered card with icon + `emptyMessage` + optional CTA (if `toolbar.onAdd`).
  - **Selection mode:** cards show leading checkbox (fade-in, disabled under `prefers-reduced-motion`); `⋮` hidden; bottom action bar appears.
- **Bottom action bar** (`fixed bottom-0 inset-x-0`, `env(safe-area-inset-bottom)`):
  - `{count} sélectionnés` (`aria-live="polite"`) + rendered `bulkActions` + `✕` to exit selection mode.
- Exits selection mode on: ✕, all rows deselected, page change, filter change.
- Container uses `role="list"`, each card wrapper `role="listitem"`.

**`data-table-mobile-toolbar.tsx` — `DataTableMobileToolbar`**
- Sticky top (`sticky top-0 z-20 bg-background/95 backdrop-blur`, respects `env(safe-area-inset-top)` for PWA).
- Row 1: full-width `<Input>` (search), filter icon button (`SlidersHorizontal` + count badge if any filter active), `+` add button.
- Filter icon opens a shadcn `Sheet` (side="bottom"):
  - Faceted filters from `config.filterableColumns` (reuses existing `DataTableFacetedFilter`).
  - **Sort section:** radio list of sortable columns + asc/desc toggle. Writes to `table.setSorting([...])`.
  - Import / Export buttons (same handlers as desktop toolbar).
- `Sheet` has `overscroll-behavior: contain` and focus trap (shadcn default).

**`data-table-mobile-pagination.tsx` — `DataTableMobilePagination`**
- Layout: `‹  Page X / Y  ›` centered, buttons 44×44 touch target, indicator uses `tabular-nums`.
- No page-size selector, no first/last, no "rows per page" label.
- Hidden entirely when `selectionMode` is active (bottom action bar takes its place).

### Mobile card mapping per table

| Table | Title | Subtitle | Right value | Badge |
|---|---|---|---|---|
| **products** | `name` | `sku · category_name` | `price` | stock level (success/warning/danger based on threshold) |
| **sales** | `sale_number` | `created_at · customer` | `total` | `status` |
| **customers** | `name` | `phone · email` | `total_spent` | `{total_purchases} achats` |
| **stores** | `name` | `address` | `phone` | active/inactive |
| **proformas** | `proforma_number` | `created_at · customer` | `total` | `status` + "Expiré" danger if past `valid_until` |

Tap card → opens existing detail/edit dialog (handler injected by feature client via `onClick`).
`⋮` menu items → existing row actions (edit, delete, duplicate, etc.) moved from the desktop actions column.

## Behavior Details

### Long-press activation

- `pointerdown` starts a 500ms timer and captures start coordinates.
- `pointermove` with distance >10px cancels the timer (scroll intent).
- `pointerup`/`pointercancel` before 500ms cancels the timer (tap intent → normal `onClick`).
- Timer fires → set `selectionMode=true`, select the pressed row, fire haptic.

### Touch & accessibility

- `touch-action: manipulation` on all interactive cards.
- `focus-visible:ring-2 ring-ring` on cards and buttons.
- `overscroll-behavior: contain` on the `Sheet` drawer.
- `aria-label` on all icon-only buttons (`⋮`, filter, `+`, pagination chevrons, ✕).
- `aria-live="polite"` on selection count and async toasts.
- Respects `prefers-reduced-motion`: disables checkbox fade-in and any card transitions beyond color.
- Non-breaking spaces in copy (`Page 2 / 10` uses `&nbsp;`, currency values keep the existing `Intl.NumberFormat`).

### State preservation

- Selection mode exits on page/filter change to avoid ghost selections.
- Row selection itself (via `rowSelection` state in `useReactTable`) persists across viewport changes — if the user rotates to landscape and crosses `md`, their selection survives into the desktop view.

## Migration Plan

Implementation order (each step independent, TypeScript + lint must pass before next):

1. **Generic pieces**
   - Add types (`MobileCardConfig`, `BulkAction`) to `types/data-table.ts`.
   - Create `data-table-card.tsx`, `data-table-mobile-list.tsx`, `data-table-mobile-toolbar.tsx`, `data-table-mobile-pagination.tsx`.
   - Modify `data-table.tsx`: accept `mobileCard`/`bulkActions`, render responsive trees side-by-side.
   - Fix existing `data-table-toolbar.tsx` / `data-table-pagination.tsx` desktop layout issues only where they leak into the `<md` fallback for tables that don't yet have `mobileCard` (`flex-wrap gap-2`).

2. **Feature migration (pilot: products)**
   - `products-data-table.tsx`: define `mobileCard` with stock-level badge logic; wire `bulkActions` if bulk delete exists; pass to `DataTable`.

3. **Remaining features** (in order): sales → customers → stores → proformas. Same pattern as products.

4. **Polish pass**
   - Manually test each page in Chrome DevTools device mode at 375px and 414px.
   - Tune copy density, padding, badge colors per table.

### Non-regression guarantees

- `mobileCard` is optional → any table not yet migrated keeps the current `<table>` scroll fallback.
- Desktop toolbar, pagination, selection, view-options are **untouched**.
- No changes to feature-level `use*Filters` hooks, URL state parsers, or server actions.

### Verification

- `pnpm tsc --noEmit` (pre-commit hook already enforces this).
- `npm run lint`.
- Manual parcours of each page on iPhone SE (375px) and iPhone Pro (414px).
- Verify long-press selection + bulk delete on at least customers.
- Verify filter `Sheet` opens/closes and applies correctly on products (most filters).

## Files Touched (estimate)

**Created (5):**
- `components/data-table/data-table-card.tsx`
- `components/data-table/data-table-mobile-list.tsx`
- `components/data-table/data-table-mobile-toolbar.tsx`
- `components/data-table/data-table-mobile-pagination.tsx`

**Modified (~7):**
- `types/data-table.ts`
- `components/data-table/data-table.tsx`
- `components/data-table/index.ts`
- `components/{products,sales,customers,stores,proformas}/*-data-table.tsx`

## Open Questions

None at approval time. Any tuning decisions (badge thresholds, exact copy, padding) are deferred to the polish pass and do not require design changes.
