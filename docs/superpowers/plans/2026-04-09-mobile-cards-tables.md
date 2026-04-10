# Mobile Cards for Data Tables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace horizontally-scrolling tables with card layouts on mobile (<md) for products, sales, customers, stores, and proformas.

**Architecture:** Single `DataTable` component renders a desktop `<table>` and a mobile card list side-by-side with CSS visibility (`hidden md:block` / `md:hidden`). One `useReactTable` instance pilots both. A new optional `mobileCard` render prop lets each feature define how rows look as cards. Long-press on a card activates a selection mode with a bottom action bar.

**Tech Stack:** Next.js 16, React 19, TanStack React Table, shadcn/ui (Card, Sheet, DropdownMenu, Checkbox, Skeleton), Tailwind CSS 4, next-intl.

**Verification cadence:** Repo has no test framework. Each task ends with `pnpm tsc --noEmit`, `npm run lint`, and (when UI changes) a manual device-mode check at 375px. Pre-commit Husky runs the same checks.

**Spec:** `docs/superpowers/specs/2026-04-09-mobile-cards-tables-design.md`

---

## Task 1: Add types for mobile cards and bulk actions

**Files:**
- Modify: `types/data-table.ts`

- [ ] **Step 1: Add new types at the end of `types/data-table.ts`**

Add these exports after the existing `ImportError` interface (after line 115):

```ts
import type { Row } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";

/**
 * Badge shown on the right of a mobile card.
 */
export type MobileCardBadgeVariant = "default" | "success" | "warning" | "danger";

export interface MobileCardBadge {
  label: React.ReactNode;
  variant?: MobileCardBadgeVariant;
}

/**
 * Menu action in the mobile card "⋮" dropdown.
 */
export interface MobileCardMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

/**
 * Content of a single mobile card, computed from a row.
 */
export interface MobileCardContent {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightValue?: React.ReactNode;
  badge?: MobileCardBadge;
  thumbnail?: React.ReactNode;
  onClick?: () => void;
  menuItems?: MobileCardMenuItem[];
}

/**
 * Render prop the DataTable consumer provides to describe each row as a card.
 */
export type MobileCardConfig<TData> = (row: Row<TData>) => MobileCardContent;

/**
 * Action available in the mobile selection-mode bottom bar.
 */
export interface BulkAction<TData> {
  label: string;
  icon?: LucideIcon;
  onClick: (rows: TData[]) => void;
  variant?: "default" | "destructive";
}
```

Then update `DataTableProps<TData, TValue>` (around line 39) to add the two new optional fields at the end:

```ts
  // Mobile cards (<md)
  mobileCard?: MobileCardConfig<TData>;
  bulkActions?: BulkAction<TData>[];
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add types/data-table.ts
git commit -m "feat(data-table): add MobileCardConfig and BulkAction types"
```

---

## Task 2: Create `DataTableCard` — the generic mobile card

**Files:**
- Create: `components/data-table/data-table-card.tsx`

- [ ] **Step 1: Write the component**

Create `components/data-table/data-table-card.tsx` with this content:

```tsx
"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MobileCardContent } from "@/types/data-table";

interface DataTableCardProps {
  content: MobileCardContent;
  selected: boolean;
  selectionMode: boolean;
  onTap: () => void;
  onLongPressActivate: () => void;
  actionsLabel: string; // i18n: "Actions"
}

const BADGE_CLASSES: Record<NonNullable<MobileCardContent["badge"]>["variant"] & string, string> = {
  default: "bg-muted text-foreground",
  success: "bg-green-500/15 text-green-600 dark:text-green-400",
  warning: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

export function DataTableCard({
  content,
  selected,
  selectionMode,
  onTap,
  onLongPressActivate,
  actionsLabel,
}: DataTableCardProps) {
  const timerRef = React.useRef<number | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = React.useRef(false);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (selectionMode) return;
    longPressFiredRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      if ("vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
      onLongPressActivate();
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_TOLERANCE_PX) {
      clearTimer();
    }
  };

  const handlePointerUp = () => {
    clearTimer();
    startRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (longPressFiredRef.current) {
      e.preventDefault();
      longPressFiredRef.current = false;
      return;
    }
    onTap();
  };

  const badgeVariant = content.badge?.variant ?? "default";

  return (
    <div
      role="listitem"
      className={cn(
        "group relative rounded-lg border bg-card transition-colors",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg p-3 text-left",
          "touch-manipulation select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:bg-muted/40 active:bg-muted/60",
        )}
      >
        {selectionMode && (
          <Checkbox
            checked={selected}
            className="pointer-events-none motion-safe:animate-in motion-safe:fade-in"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {content.thumbnail && (
          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
            {content.thumbnail}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{content.title}</div>
          {content.subtitle && (
            <div className="truncate text-xs text-muted-foreground">{content.subtitle}</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {content.rightValue && (
            <div className="text-sm font-semibold tabular-nums">{content.rightValue}</div>
          )}
          {content.badge && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                BADGE_CLASSES[badgeVariant],
              )}
            >
              {content.badge.label}
            </span>
          )}
        </div>
      </button>

      {!selectionMode && content.menuItems && content.menuItems.length > 0 && (
        <div className="absolute right-1 top-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
                aria-label={actionsLabel}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {content.menuItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={i}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={cn(item.variant === "destructive" && "text-destructive")}
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/data-table/data-table-card.tsx
git commit -m "feat(data-table): add DataTableCard mobile card component"
```

---

## Task 3: Create `DataTableMobileList` — the card list with selection mode

**Files:**
- Create: `components/data-table/data-table-mobile-list.tsx`

- [ ] **Step 1: Write the component**

Create `components/data-table/data-table-mobile-list.tsx`:

```tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableCard } from "./data-table-card";
import type { BulkAction, MobileCardConfig } from "@/types/data-table";

interface DataTableMobileListProps<TData> {
  table: Table<TData>;
  mobileCard: MobileCardConfig<TData>;
  bulkActions?: BulkAction<TData>[];
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTableMobileList<TData>({
  table,
  mobileCard,
  bulkActions,
  isLoading,
  emptyMessage,
}: DataTableMobileListProps<TData>) {
  const t = useTranslations("DataTable");
  const [selectionMode, setSelectionMode] = React.useState(false);

  const rows = table.getRowModel().rows;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Exit selection mode when there are no selected rows left (e.g. page change)
  React.useEffect(() => {
    if (selectionMode && selectedCount === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedCount]);

  // Exit selection mode when filters/pagination/sorting change
  const filterState = table.getState().columnFilters;
  const pageIndex = table.getState().pagination.pageIndex;
  React.useEffect(() => {
    if (selectionMode) {
      table.resetRowSelection();
      setSelectionMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterState, pageIndex]);

  const exitSelectionMode = () => {
    table.resetRowSelection();
    setSelectionMode(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-2" role="list" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <Skeleton className="h-11 w-11 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className="flex min-h-40 items-center justify-center rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground"
        role="status"
      >
        {emptyMessage ?? t("noResults")}
      </div>
    );
  }

  return (
    <>
      <div role="list" className="space-y-2 pb-24">
        {rows.map((row) => {
          const content = mobileCard(row);
          return (
            <DataTableCard
              key={row.id}
              content={content}
              selected={row.getIsSelected()}
              selectionMode={selectionMode}
              actionsLabel={t("actions")}
              onTap={() => {
                if (selectionMode) {
                  row.toggleSelected(!row.getIsSelected());
                } else {
                  content.onClick?.();
                }
              }}
              onLongPressActivate={() => {
                setSelectionMode(true);
                row.toggleSelected(true);
              }}
            />
          );
        })}
      </div>

      {selectionMode && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur",
            "pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <div className="flex items-center gap-2 p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={exitSelectionMode}
              aria-label={t("clearSelection")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span
              className="flex-1 text-sm font-medium"
              aria-live="polite"
            >
              {t("rowsSelectedShort", { count: selectedCount })}
            </span>
            <div className="flex items-center gap-2">
              {bulkActions?.map((action, i) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={i}
                    size="sm"
                    variant={action.variant === "destructive" ? "destructive" : "outline"}
                    onClick={() =>
                      action.onClick(selectedRows.map((r) => r.original))
                    }
                  >
                    {Icon && <Icon className="mr-1 h-4 w-4" aria-hidden="true" />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Add the two missing i18n keys**

Edit `messages/fr.json` — find the `DataTable` section and add:

```json
  "actions": "Actions",
  "rowsSelectedShort": "{count} sélectionné(s)",
  "clearSelection": "Tout désélectionner",
  "filters": "Filtres",
  "sortBy": "Trier par",
  "ascending": "Croissant",
  "descending": "Décroissant",
  "apply": "Appliquer"
```

Edit `messages/en.json` — add the same keys in the `DataTable` section:

```json
  "actions": "Actions",
  "rowsSelectedShort": "{count} selected",
  "clearSelection": "Clear selection",
  "filters": "Filters",
  "sortBy": "Sort by",
  "ascending": "Ascending",
  "descending": "Descending",
  "apply": "Apply"
```

Note: if `DataTable.actions` already exists, keep the existing value. Same for any already-present key — do not duplicate.

- [ ] **Step 3: Ensure `Skeleton` is installed**

Run: `ls components/ui/skeleton.tsx`
If missing: `npx shadcn@latest add skeleton` and answer yes to overwrite prompts if any.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/data-table/data-table-mobile-list.tsx messages/fr.json messages/en.json components/ui/skeleton.tsx
git commit -m "feat(data-table): add DataTableMobileList with long-press selection"
```

---

## Task 4: Create `DataTableMobileToolbar` — search + filter/sort drawer

**Files:**
- Create: `components/data-table/data-table-mobile-toolbar.tsx`

- [ ] **Step 1: Ensure the `Sheet` and `RadioGroup` shadcn components exist**

Run: `ls components/ui/sheet.tsx components/ui/radio-group.tsx 2>&1`
If either is missing: `npx shadcn@latest add sheet radio-group`

- [ ] **Step 2: Write the component**

Create `components/data-table/data-table-mobile-toolbar.tsx`:

```tsx
"use client";

import * as React from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import type { DataTableToolbarConfig } from "@/types/data-table";

interface DataTableMobileToolbarProps<TData> {
  table: Table<TData>;
  config?: DataTableToolbarConfig<TData>;
}

export function DataTableMobileToolbar<TData>({
  table,
  config,
}: DataTableMobileToolbarProps<TData>) {
  const t = useTranslations("DataTable");
  const tCommon = useTranslations("Common");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const activeFilterCount = table.getState().columnFilters.length;
  const isFiltered = activeFilterCount > 0;

  const sortableColumns = table
    .getAllColumns()
    .filter((c) => c.getCanSort() && c.columnDef.header);

  const currentSort = table.getState().sorting[0];

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 py-2 backdrop-blur",
        "pt-[max(0.5rem,env(safe-area-inset-top))]",
      )}
    >
      {config?.searchKey && (
        <Input
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={config.searchPlaceholder ?? t("search")}
          value={
            (table.getColumn(config.searchKey)?.getFilterValue() as string) ?? ""
          }
          onChange={(e) =>
            table.getColumn(config.searchKey!)?.setFilterValue(e.target.value)
          }
          className="h-9 flex-1 min-w-0"
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative h-9 w-9 shrink-0"
            aria-label={t("filters")}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto overscroll-contain"
        >
          <SheetHeader>
            <SheetTitle>{t("filters")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 py-4">
            {config?.filterableColumns && config.filterableColumns.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.filterableColumns.map((fc) => {
                  const column = table.getColumn(fc.id);
                  return column ? (
                    <DataTableFacetedFilter
                      key={fc.id}
                      column={column}
                      title={fc.title}
                      options={fc.options}
                    />
                  ) : null;
                })}
                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => table.resetColumnFilters()}
                  >
                    {tCommon("reset")}
                    <X className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}

            {sortableColumns.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">{t("sortBy")}</div>
                <RadioGroup
                  value={currentSort?.id ?? ""}
                  onValueChange={(id) => {
                    table.setSorting([{ id, desc: currentSort?.desc ?? false }]);
                  }}
                  className="space-y-1"
                >
                  {sortableColumns.map((col) => (
                    <div key={col.id} className="flex items-center gap-2">
                      <RadioGroupItem value={col.id} id={`sort-${col.id}`} />
                      <Label htmlFor={`sort-${col.id}`} className="text-sm font-normal">
                        {typeof col.columnDef.header === "string"
                          ? col.columnDef.header
                          : col.id}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {currentSort && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant={!currentSort.desc ? "default" : "outline"}
                      onClick={() =>
                        table.setSorting([{ id: currentSort.id, desc: false }])
                      }
                    >
                      {t("ascending")}
                    </Button>
                    <Button
                      size="sm"
                      variant={currentSort.desc ? "default" : "outline"}
                      onClick={() =>
                        table.setSorting([{ id: currentSort.id, desc: true }])
                      }
                    >
                      {t("descending")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <SheetFooter>
            <Button onClick={() => setSheetOpen(false)} className="w-full">
              {t("apply")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {config?.onAdd && (
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={config.onAdd}
          aria-label={config.addLabel ?? tCommon("add")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
```

Note: the sort section uses the column `id` as label fallback because many columns use a React-node header (`DataTableColumnHeader`). Feature tables that want nicer labels can override later; this is acceptable for v1.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/data-table/data-table-mobile-toolbar.tsx components/ui/sheet.tsx components/ui/radio-group.tsx
git commit -m "feat(data-table): add DataTableMobileToolbar with filter/sort sheet"
```

---

## Task 5: Create `DataTableMobilePagination` — compact pagination

**Files:**
- Create: `components/data-table/data-table-mobile-pagination.tsx`

- [ ] **Step 1: Write the component**

Create `components/data-table/data-table-mobile-pagination.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Table } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface DataTableMobilePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTableMobilePagination<TData>({
  table,
}: DataTableMobilePaginationProps<TData>) {
  const t = useTranslations("DataTable");
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        aria-label={t("goToPrevious")}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <div
        className="min-w-24 text-center text-sm font-medium tabular-nums"
        aria-live="polite"
      >
        {t("page", { current: pageIndex + 1, total: pageCount })}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        aria-label={t("goToNext")}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint + commit**

```bash
pnpm tsc --noEmit && npm run lint
git add components/data-table/data-table-mobile-pagination.tsx
git commit -m "feat(data-table): add DataTableMobilePagination"
```

---

## Task 6: Wire mobile components into `DataTable` with responsive rendering

**Files:**
- Modify: `components/data-table/data-table.tsx`
- Modify: `components/data-table/index.ts`

- [ ] **Step 1: Update `data-table.tsx` to render mobile + desktop trees**

In `components/data-table/data-table.tsx`:

1. Add imports near the top (after line 21):

```tsx
import { DataTableMobileList } from "@/components/data-table/data-table-mobile-list";
import { DataTableMobileToolbar } from "@/components/data-table/data-table-mobile-toolbar";
import { DataTableMobilePagination } from "@/components/data-table/data-table-mobile-pagination";
```

2. In the destructured props (around line 24-49), add after `onPaginationChange`:

```tsx
  mobileCard,
  bulkActions,
```

3. Replace the `return (...)` block (lines 192-297) with:

```tsx
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Desktop toolbar */}
      {toolbar && (
        <div className="hidden md:block">
          <DataTableToolbar table={table} config={toolbar} />
        </div>
      )}

      {/* Mobile toolbar — only shown when mobileCard is provided */}
      {mobileCard && (
        <div className="md:hidden">
          <DataTableMobileToolbar table={table} config={toolbar} />
        </div>
      )}

      {/* Desktop table */}
      <div
        className={cn(
          "rounded-md border flex-1 min-h-0",
          mobileCard && "hidden md:block",
        )}
      >
        <div className="relative h-full overflow-auto overscroll-x-contain">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b sticky top-0 z-10 bg-card shadow-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className={cn(
                    "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                    "bg-card hover:bg-card border-b-2"
                  )}
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
                        "!font-bold"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className={cn("[&_tr:last-child]:border-0")}>
              {isLoading ? (
                <tr className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                  <td
                    colSpan={columns.length}
                    className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] h-24 text-center"
                  >
                    {t("loading")}
                  </td>
                </tr>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                  <td
                    colSpan={columns.length}
                    className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] h-24 text-center"
                  >
                    {emptyMessage ?? t("noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      {mobileCard && (
        <div className="md:hidden flex-1 min-h-0 overflow-y-auto">
          <DataTableMobileList
            table={table}
            mobileCard={mobileCard}
            bulkActions={bulkActions}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
          />
        </div>
      )}

      {enablePagination && (
        <div className="flex-shrink-0">
          <div className="hidden md:block">
            <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
          </div>
          {mobileCard && (
            <div className="md:hidden">
              <DataTableMobilePagination table={table} />
            </div>
          )}
        </div>
      )}
    </div>
  );
```

- [ ] **Step 2: Update `components/data-table/index.ts` to export the new pieces**

Replace the file content with:

```ts
export { DataTable } from "./data-table";
export { DataTableCard } from "./data-table-card";
export { DataTableColumnHeader } from "./data-table-column-header";
export { DataTableFacetedFilter } from "./data-table-faceted-filter";
export { DataTableMobileList } from "./data-table-mobile-list";
export { DataTableMobilePagination } from "./data-table-mobile-pagination";
export { DataTableMobileToolbar } from "./data-table-mobile-toolbar";
export { DataTablePagination } from "./data-table-pagination";
export { DataTableToolbar } from "./data-table-toolbar";
export { DataTableViewOptions } from "./data-table-view-options";
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`
Open http://localhost:3000/products in Chrome DevTools device mode at 375px.
Expected: page still loads with the existing table (no `mobileCard` provided yet → fallback to desktop table). Desktop view at 1280px: unchanged.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/data-table/data-table.tsx components/data-table/index.ts
git commit -m "feat(data-table): render mobile card tree under md breakpoint"
```

---

## Task 7: Migrate Products to mobile cards (pilot)

**Files:**
- Modify: `components/products/products-data-table.tsx`

- [ ] **Step 1: Add the `mobileCard` and `bulkActions` imports and config**

In `components/products/products-data-table.tsx`:

1. Update the type import (around line 7) to also import `Row`:

```tsx
import { ColumnDef, type ColumnFiltersState, type SortingState, type Row } from "@tanstack/react-table";
```

2. Add import for the config type near the other imports (after line 11):

```tsx
import type { MobileCardConfig, BulkAction } from "@/types/data-table";
```

3. Just before `const columns: ColumnDef<Product>[] = [` (around line 189), add a helper for the stock badge variant:

```tsx
const getStockBadgeVariant = (
  quantity: number,
  minLevel: number | null,
): "success" | "warning" | "danger" => {
  if (quantity === 0) return "danger";
  if (minLevel !== null && quantity < minLevel) return "warning";
  return "success";
};
```

4. After the `columns` array (after line 412, before the `categories` computation), add the mobile card config:

```tsx
const mobileCard: MobileCardConfig<Product> = (row: Row<Product>) => {
  const p = row.original;
  const quantity = (isAdmin
    ? p.quantity
    : (p.my_quantity ?? p.quantity)) ?? 0;
  const price = p.price ?? 0;
  const formattedPrice = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  return {
    title: p.name ?? "—",
    subtitle: [p.sku, p.category_name ?? t("categories.uncategorized")]
      .filter(Boolean)
      .join(" · "),
    rightValue: `${formattedPrice}\u00A0${CURRENCY_CONFIG.symbol}`,
    badge: {
      label: String(quantity),
      variant: getStockBadgeVariant(quantity, p.min_stock_level),
    },
    thumbnail: p.image_url ? (
      <OptimizedImage
        src={p.image_url}
        alt={p.name ?? ""}
        fill
        className="object-cover"
        sizes="44px"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
        N/A
      </div>
    ),
    onClick: () => router.push(`/products/${p.template_id}`),
    menuItems: [
      {
        label: t("actions.viewDetails"),
        icon: Eye,
        onClick: () => router.push(`/products/${p.template_id}`),
      },
      {
        label: t("actions.edit"),
        icon: Pencil,
        onClick: () => router.push(`/products/${p.template_id}/edit`),
      },
      {
        label: p.is_active ? t("actions.deactivate") : t("actions.activate"),
        icon: p.is_active ? XCircle : CheckCircle2,
        onClick: () =>
          handleToggleStatus(p.template_id!, p.is_active ?? false),
        disabled: isPending,
      },
      {
        label: t("actions.delete"),
        icon: Trash2,
        onClick: () => confirmDelete(p.template_id!),
        variant: "destructive",
        disabled: isPending,
      },
    ],
  };
};

const bulkActions: BulkAction<Product>[] = [
  {
    label: t("actions.delete"),
    icon: Trash2,
    variant: "destructive",
    onClick: (rows) => {
      // Delegate to existing single-delete loop (simple v1).
      rows.forEach((r) => {
        if (r.template_id) confirmDelete(r.template_id);
      });
    },
  },
];
```

5. Pass the new props to `<DataTable>` (around line 430). Add after `enableRowSelection`:

```tsx
        mobileCard={mobileCard}
        bulkActions={bulkActions}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
In Chrome DevTools device mode (iPhone SE, 375×667):
1. Navigate to `/products`.
2. Verify: cards visible, desktop table hidden. Thumbnail + name + sku/category + price + stock badge.
3. Tap a card → navigates to product detail.
4. Long-press a card (hold 500ms) → selection mode activates, checkbox appears, bottom bar shows count + Delete.
5. Tap ✕ → exits selection mode.
6. Tap filter icon → sheet opens with category/status filters + sort options.
7. Search input filters by name.
8. Resize to 1280px → full table returns, sheet hidden.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add components/products/products-data-table.tsx
git commit -m "feat(products): enable mobile card layout on products table"
```

---

## Task 8: Migrate Sales to mobile cards

**Files:**
- Read first: `components/sales/sales-data-table.tsx`
- Modify: `components/sales/sales-data-table.tsx`

- [ ] **Step 1: Read the file to find row actions and the detail dialog trigger**

Run the Read tool on `components/sales/sales-data-table.tsx`. Identify:
- The row shape type (likely `Sale`).
- How row click currently opens the detail dialog (often sets state + opens `<SaleDetailDialog>`).
- Existing action handlers (refund, print, etc.).

- [ ] **Step 2: Add `mobileCard` config**

In `components/sales/sales-data-table.tsx`:

1. Add the same imports as Products (if not present):

```tsx
import type { Row } from "@tanstack/react-table";
import type { MobileCardConfig, BulkAction } from "@/types/data-table";
```

2. Define a status badge variant helper near the top of the component:

```tsx
const getSaleStatusVariant = (status: string): "success" | "warning" | "danger" | "default" => {
  switch (status) {
    case "completed":
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
    case "refunded":
      return "danger";
    default:
      return "default";
  }
};
```

3. Just after the columns array, define `mobileCard`:

```tsx
const mobileCard: MobileCardConfig<Sale> = (row: Row<Sale>) => {
  const s = row.original;
  const total = s.total ?? 0;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(total);
  const date = s.created_at
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(s.created_at))
    : "—";

  return {
    title: s.sale_number ?? "—",
    subtitle: `${date} · ${s.customer_name ?? t("walkInCustomer")}`,
    rightValue: `${formatted}\u00A0${CURRENCY_CONFIG.symbol}`,
    badge: {
      label: t(`status.${s.status}`),
      variant: getSaleStatusVariant(s.status ?? ""),
    },
    onClick: () => {
      // Reuse the existing handler that opens SaleDetailDialog.
      // If the existing table opens the detail via a setter like setSelectedSale(s),
      // call it here.
      openDetail(s);
    },
    menuItems: buildSaleMenuItems(s), // extract from existing actions column
  };
};
```

Note: `openDetail` and `buildSaleMenuItems` are placeholders — replace with the actual handlers you find in Step 1. The goal is to reuse the existing dialog/action wiring, not to duplicate it.

4. Pass `mobileCard` to `<DataTable>`:

```tsx
        mobileCard={mobileCard}
```

(Skip `bulkActions` for sales — refunds/voids are per-sale operations.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`
Expected: PASS. If `Sale` type has different field names, fix inline.

- [ ] **Step 4: Manual verification at 375px**

Run: `npm run dev`
Navigate to `/sales`. Verify cards show sale number / date+customer / total / status badge. Tap opens detail dialog. Filter sheet opens. Date is locale-formatted.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/sales/sales-data-table.tsx
git commit -m "feat(sales): enable mobile card layout on sales table"
```

---

## Task 9: Migrate Customers to mobile cards

**Files:**
- Read first: `components/customers/customers-data-table.tsx`
- Modify: `components/customers/customers-data-table.tsx`

- [ ] **Step 1: Read the file** to identify the `Customer` type, existing edit dialog handler, and delete handler.

- [ ] **Step 2: Add `mobileCard` and `bulkActions`**

Add imports as in Task 7/8. Define:

```tsx
const mobileCard: MobileCardConfig<Customer> = (row: Row<Customer>) => {
  const c = row.original;
  const spent = c.total_spent ?? 0;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(spent);

  return {
    title: c.name ?? "—",
    subtitle: [c.phone, c.email].filter(Boolean).join(" · ") || "—",
    rightValue: `${formatted}\u00A0${CURRENCY_CONFIG.symbol}`,
    badge: {
      label: t("mobileCard.purchasesCount", { count: c.total_purchases ?? 0 }),
      variant: "default",
    },
    onClick: () => openEditDialog(c),
    menuItems: [
      {
        label: t("actions.edit"),
        icon: Pencil,
        onClick: () => openEditDialog(c),
      },
      {
        label: t("actions.delete"),
        icon: Trash2,
        onClick: () => confirmDelete(c.id),
        variant: "destructive",
      },
    ],
  };
};

const bulkActions: BulkAction<Customer>[] = [
  {
    label: t("actions.delete"),
    icon: Trash2,
    variant: "destructive",
    onClick: (rows) => rows.forEach((c) => confirmDelete(c.id)),
  },
];
```

Replace `openEditDialog` and `confirmDelete` with the existing functions found in Step 1.

Also add i18n key `Customers.mobileCard.purchasesCount` in both `messages/fr.json` (`"{count} achat(s)"`) and `messages/en.json` (`"{count} purchase(s)"`).

Pass `mobileCard` and `bulkActions` to `<DataTable>`.

- [ ] **Step 3: Typecheck + lint + verify at 375px + commit**

```bash
pnpm tsc --noEmit && npm run lint
# manual verification on /customers
git add components/customers/customers-data-table.tsx messages/fr.json messages/en.json
git commit -m "feat(customers): enable mobile card layout on customers table"
```

---

## Task 10: Migrate Stores to mobile cards

**Files:**
- Read first: `components/stores/stores-data-table.tsx`
- Modify: `components/stores/stores-data-table.tsx`

- [ ] **Step 1: Read the file** to identify the `Store` type, the active/inactive field, and edit/delete handlers.

- [ ] **Step 2: Add `mobileCard`**

```tsx
const mobileCard: MobileCardConfig<Store> = (row: Row<Store>) => {
  const s = row.original;
  return {
    title: s.name ?? "—",
    subtitle: s.address ?? "—",
    rightValue: s.phone ?? undefined,
    badge: s.is_active
      ? { label: t("status.active"), variant: "success" }
      : { label: t("status.inactive"), variant: "default" },
    onClick: () => openEditDialog(s),
    menuItems: [
      {
        label: t("actions.edit"),
        icon: Pencil,
        onClick: () => openEditDialog(s),
      },
      {
        label: t("actions.delete"),
        icon: Trash2,
        onClick: () => confirmDelete(s.id),
        variant: "destructive",
      },
    ],
  };
};
```

Pass `mobileCard` to `<DataTable>`. No bulk actions for stores.

- [ ] **Step 3: Typecheck + lint + verify at 375px + commit**

```bash
pnpm tsc --noEmit && npm run lint
# manual verification on /stores
git add components/stores/stores-data-table.tsx
git commit -m "feat(stores): enable mobile card layout on stores table"
```

---

## Task 11: Migrate Proformas to mobile cards

**Files:**
- Read first: `components/proformas/proformas-data-table.tsx`
- Modify: `components/proformas/proformas-data-table.tsx`

- [ ] **Step 1: Read the file** to identify the `Proforma` type and existing handlers (detail dialog, convert to sale, update status, delete, print).

- [ ] **Step 2: Add `mobileCard`**

```tsx
const getProformaStatusVariant = (
  status: string,
  validUntil: string | null,
): "success" | "warning" | "danger" | "default" => {
  if (validUntil && new Date(validUntil) < new Date()) return "danger";
  switch (status) {
    case "accepted":
    case "converted":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
    case "expired":
      return "danger";
    default:
      return "default";
  }
};

const mobileCard: MobileCardConfig<Proforma> = (row: Row<Proforma>) => {
  const p = row.original;
  const total = p.total ?? 0;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(total);
  const date = p.created_at
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(p.created_at))
    : "—";
  const isExpired = p.valid_until
    ? new Date(p.valid_until) < new Date()
    : false;

  return {
    title: p.proforma_number ?? "—",
    subtitle: `${date} · ${p.customer_name ?? "—"}`,
    rightValue: `${formatted}\u00A0${CURRENCY_CONFIG.symbol}`,
    badge: {
      label: isExpired ? t("status.expired") : t(`status.${p.status}`),
      variant: getProformaStatusVariant(p.status ?? "", p.valid_until),
    },
    onClick: () => openDetailDialog(p),
    menuItems: buildProformaMenuItems(p), // reuse existing actions
  };
};
```

Replace handlers with those found in Step 1. Add `Proformas.status.expired` i18n key if missing in `messages/fr.json` (`"Expiré"`) and `messages/en.json` (`"Expired"`).

Pass `mobileCard` to `<DataTable>`.

- [ ] **Step 3: Typecheck + lint + verify at 375px + commit**

```bash
pnpm tsc --noEmit && npm run lint
# manual verification on /proformas
git add components/proformas/proformas-data-table.tsx messages/fr.json messages/en.json
git commit -m "feat(proformas): enable mobile card layout on proformas table"
```

---

## Task 12: Fix desktop toolbar & pagination mobile-fallback layout issues

**Files:**
- Modify: `components/data-table/data-table-toolbar.tsx`
- Modify: `components/data-table/data-table-pagination.tsx`

This task fixes the desktop toolbar and pagination so that any table NOT yet migrated to `mobileCard` (or any future table) still renders acceptably below `md`. Small defensive changes, no behavior change on desktop.

- [ ] **Step 1: Update `data-table-toolbar.tsx`**

Replace the root `<div>` (line 76) with:

```tsx
<div className="flex flex-wrap items-center justify-between gap-2">
```

Replace the left group (line 77):

```tsx
<div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
```

Replace the right group (line 115):

```tsx
<div className="flex flex-wrap items-center gap-2">
```

Update the search input className (line 90) from `"h-8 w-[150px] lg:w-[250px]"` to:

```tsx
className="h-8 w-full sm:w-[200px] lg:w-[250px]"
```

- [ ] **Step 2: Update `data-table-pagination.tsx`**

Replace the root `<div>` (line 35):

```tsx
<div className="flex flex-wrap items-center justify-between gap-2 px-2">
```

Replace the right group (line 39):

```tsx
<div className="flex flex-wrap items-center gap-4 lg:gap-6">
```

Wrap the `rowsPerPage` label group so the text hides on mobile. Replace lines 40-59 with:

```tsx
<div className="flex items-center gap-2">
  <p className="hidden text-sm font-medium sm:block">{t("rowsPerPage")}</p>
  <Select
    value={`${table.getState().pagination.pageSize}`}
    onValueChange={(value) => {
      table.setPageSize(Number(value));
    }}
  >
    <SelectTrigger className="h-8 w-[70px]">
      <SelectValue placeholder={table.getState().pagination.pageSize} />
    </SelectTrigger>
    <SelectContent side="top">
      {pageSizeOptions.map((pageSize) => (
        <SelectItem key={pageSize} value={`${pageSize}`}>
          {pageSize}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc --noEmit && npm run lint`

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
Check `/products` at 1280px (desktop unchanged) and at 375px (toolbar wraps, pagination wraps). Both the migrated table (cards) and any non-migrated fallback should look reasonable.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/data-table/data-table-toolbar.tsx components/data-table/data-table-pagination.tsx
git commit -m "fix(data-table): wrap desktop toolbar and pagination on narrow screens"
```

---

## Task 13: Final full-app mobile QA pass

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk through each page in Chrome DevTools device mode**

For each of: `/products`, `/sales`, `/customers`, `/stores`, `/proformas` — at **375×667** (iPhone SE) and **414×896** (iPhone Pro):

Verify checklist per page:
- Sticky toolbar visible, search usable, filter sheet opens and closes.
- Cards render, thumbnails/badges/right values look correct.
- Tap card → opens expected detail/edit UI.
- Long-press → enters selection mode, bottom bar shows count.
- ✕ exits selection mode.
- Pagination arrows visible, centered, 44×44, tabular-nums page indicator.
- Empty state renders (filter to produce no results).
- Loading state (throttle network to Slow 3G + reload) shows skeletons.
- Rotate to 667×375 landscape — still usable.
- Resize to ≥768px — desktop table returns, no dangling bottom action bar.

Note any issues and fix inline; commit fixes with `fix(mobile): ...` messages.

- [ ] **Step 3: Final typecheck + lint + build**

```bash
pnpm tsc --noEmit
npm run lint
npm run build
```

All three must PASS.

- [ ] **Step 4: Final summary commit (only if polish changes were made)**

If polish fixes were committed in Step 2, nothing extra needed. Otherwise skip.

---

## Self-Review Checklist

- ✅ **Spec coverage:** All 5 tables (products, sales, customers, stores, proformas) have a migration task. Mobile toolbar, card, selection mode, bulk action bar, mobile pagination, responsive `DataTable` wiring all have tasks. Desktop toolbar/pagination fallback fix is Task 12.
- ✅ **Placeholders:** Tasks 8-11 intentionally reference existing handlers in feature files (`openDetail`, `buildSaleMenuItems`, etc.) that must be read first — each task has an explicit Step 1 "Read the file" step to find them. Not a placeholder — it's acknowledging existing code the engineer must wire into.
- ✅ **Type consistency:** `MobileCardConfig`, `BulkAction`, `MobileCardContent` used consistently across Tasks 1-11.
- ✅ **Order:** Types → generic components → `DataTable` wiring → feature migrations → toolbar/pagination polish → QA.
