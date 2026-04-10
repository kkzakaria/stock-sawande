"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { CURRENCY_CONFIG } from '@/lib/config/currency'
import { formatNumber } from '@/lib/utils/format-currency'
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { ColumnDef, type ColumnFiltersState, type SortingState, type Row } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle2, XCircle } from "lucide-react";
import { StockQuantityPopover } from "./stock-quantity-popover";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table";
import type { MobileCardConfig, BulkAction } from "@/types/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteProduct, toggleProductStatus } from "@/lib/actions/products";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryStates } from 'nuqs';
import {
  columnFiltersParser,
  sortingStateParser,
  pageIndexParser,
  pageSizeParser
} from '@/lib/url-state-parsers';

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

interface ProductsDataTableProps {
  products: Product[];
  onAddProduct?: () => void;
  pageCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  // User role to determine column visibility
  userRole?: string | null;
  // Initial state from URL
  initialColumnFilters?: ColumnFiltersState;
  initialSorting?: SortingState;
  initialPagination?: { pageIndex: number; pageSize: number };
}

export function ProductsDataTable({
  products,
  onAddProduct,
  pageCount,
  pageSize,
  onPaginationChange,
  userRole,
  // Initial state from URL
  initialColumnFilters = [],
  initialSorting = [],
  initialPagination = { pageIndex: 0, pageSize: 10 },
}: ProductsDataTableProps) {
  const isAdmin = userRole === 'admin';
  const t = useTranslations("Products");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);

  // nuqs state for URL synchronization (write-only, we use initialValues for reading)
  const [, setUrlState] = useQueryStates({
    filters: columnFiltersParser,
    sorting: sortingStateParser,
    pageIndex: pageIndexParser,
    pageSize: pageSizeParser,
  }, {
    shallow: true,
  });

  // Track if this is the first render to avoid syncing initial state to URL
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // Callbacks to sync state changes to URL
  const handleColumnFiltersChange = useCallback((filters: ColumnFiltersState) => {
    if (isFirstRender.current) return;
    setUrlState({
      filters,
      pageIndex: 0, // Reset to first page when filters change
    });
  }, [setUrlState]);

  const handleSortingChange = useCallback((sorting: SortingState) => {
    if (isFirstRender.current) return;
    setUrlState({ sorting });
  }, [setUrlState]);

  const handlePaginationChangeInternal = useCallback((pagination: { pageIndex: number; pageSize: number }) => {
    if (isFirstRender.current) return;
    setUrlState({
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
    });
    // Also call the external pagination handler if provided (for server-side pagination)
    if (onPaginationChange) {
      onPaginationChange(pagination.pageIndex, pagination.pageSize);
    }
  }, [setUrlState, onPaginationChange]);

  const handleDelete = async () => {
    // Bulk delete: process all IDs in the queue
    if (bulkDeleteIds.length > 0) {
      startTransition(async () => {
        let successCount = 0;
        let failCount = 0;
        for (const id of bulkDeleteIds) {
          const result = await deleteProduct(id);
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
        setDeleteDialogOpen(false);
        setBulkDeleteIds([]);
        if (successCount > 0) toast.success(t("messages.deletedCount", { count: successCount }));
        if (failCount > 0) toast.error(t("errors.deleteFailedCount", { count: failCount }));
        router.refresh();
      });
      return;
    }

    // Single delete
    if (!productToDelete) return;
    startTransition(async () => {
      const result = await deleteProduct(productToDelete);
      if (result.success) {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        toast.success(t("messages.deleted"));
        router.refresh();
      } else {
        toast.error(result.error || t("errors.deleteFailed"));
      }
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleProductStatus(id, !currentStatus);
      if (result.success) {
        toast.success(!currentStatus ? t("messages.activated") : t("messages.deactivated"));
        router.refresh();
      } else {
        toast.error(result.error || t("errors.updateFailed"));
      }
    });
  };

  const confirmDelete = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStockBadgeVariant = (
    quantity: number,
    minLevel: number | null,
  ): "success" | "warning" | "danger" => {
    if (quantity === 0) return "danger";
    if (minLevel !== null && quantity < minLevel) return "warning";
    return "success";
  };

  const getStockColor = (quantity: number, minLevel: number | null) => {
    if (quantity === 0) {
      return "text-red-500 font-semibold";
    } else if (minLevel !== null && quantity < minLevel) {
      return "text-orange-500 font-semibold";
    }
    return "text-green-600 font-semibold";
  };

  const columns: ColumnDef<Product>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.product")} />
      ),
      cell: ({ row }) => {
        const imageUrl = row.original.image_url;
        const name = row.getValue("name") as string;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border">
              {imageUrl ? (
                <OptimizedImage
                  src={imageUrl}
                  alt={name || t("columns.product")}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  N/A
                </div>
              )}
            </div>
            <span className="font-medium">{name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.sku")} />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("sku")}</span>
      ),
    },
    {
      accessorKey: "category_name",
      id: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.category")} />
      ),
      cell: ({ row }) => {
        const category = row.original.category_name;
        return <span>{category || t("categories.uncategorized")}</span>;
      },
      filterFn: (row, id, value) => {
        return value.includes(row.original.category_name || "uncategorized");
      },
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.price")} />
      ),
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("price"));
        return `${formatNumber(price)} ${CURRENCY_CONFIG.symbol}`;
      },
    },
    // Quantity column - displays differently for admin vs manager/cashier
    // Admin: total(n) - e.g., "100(3)"
    // Manager: my_stock/total(n) - e.g., "45/100(3)" with color on my_stock
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.quantity")} />
      ),
      cell: ({ row }) => {
        const productId = row.original.template_id;
        const storeCount = row.original.store_count;
        const minLevel = row.original.min_stock_level;

        if (isAdmin) {
          // Admin view: just show total with popover
          const quantity = row.getValue("quantity") as number;
          return (
            <StockQuantityPopover
              productId={productId || ''}
              quantity={quantity}
              storeCount={storeCount}
              className={getStockColor(quantity, minLevel)}
            />
          );
        } else {
          // Manager/Cashier view: show my_stock/total with popover on total
          const myQuantity = row.original.my_quantity ?? 0;
          const totalQuantity = row.original.total_quantity ?? row.getValue("quantity") as number ?? 0;

          // If only one store or my stock equals total, show simple view
          if (!storeCount || storeCount <= 1 || myQuantity === totalQuantity) {
            return (
              <span className={getStockColor(myQuantity, minLevel)}>
                {myQuantity}
              </span>
            );
          }

          // Show: my_stock / total(n)
          return (
            <span className="flex items-center gap-0.5">
              <span className={getStockColor(myQuantity, minLevel)}>
                {myQuantity}
              </span>
              <span className="text-muted-foreground">/</span>
              <StockQuantityPopover
                productId={productId || ''}
                quantity={totalQuantity}
                storeCount={storeCount}
                className="text-muted-foreground"
              />
            </span>
          );
        }
      },
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.status")} />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue("is_active");
        return isActive ? (
          <Badge variant="outline" className="border-green-500 text-green-500">{t("status.active")}</Badge>
        ) : (
          <Badge variant="secondary">{t("status.inactive")}</Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id) ? "active" : "inactive");
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const product = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{tCommon("actions")}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{tCommon("actions")}</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/products/${product.template_id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  {t("actions.viewDetails")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/products/${product.template_id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("actions.edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  handleToggleStatus(product.template_id!, product.is_active ?? false)
                }
                disabled={isPending}
              >
                {product.is_active ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("actions.deactivate")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t("actions.activate")}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => confirmDelete(product.template_id!)}
                className="text-destructive"
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const mobileCard: MobileCardConfig<Product> = (row: Row<Product>) => {
    const p = row.original;
    const quantity = (isAdmin
      ? p.quantity
      : (p.my_quantity ?? p.quantity)) ?? 0;
    const formatPrice = (n: number) =>
      `${formatNumber(n)}\u00A0${CURRENCY_CONFIG.symbol}`;
    const hasRange =
      p.min_price != null &&
      p.max_price != null &&
      p.min_price !== p.max_price;
    const priceDetails = hasRange
      ? `${formatPrice(p.min_price!)} – ${formatPrice(p.max_price!)}`
      : formatPrice(p.price ?? 0);

    return {
      title: p.name ?? "—",
      subtitle: [p.sku, p.category_name ?? t("categories.uncategorized")]
        .filter(Boolean)
        .join(" · "),
      details: priceDetails,
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
        const ids = rows.map((r) => r.template_id).filter(Boolean) as string[];
        if (ids.length === 0) return;
        setBulkDeleteIds(ids);
        setDeleteDialogOpen(true);
      },
    },
  ];

  // Collect unique categories for filters
  const categories = Array.from(
    new Set(products.map((p) => p.category_name).filter(Boolean))
  ).map((name) => ({
    label: name!,
    value: name!,
  }));

  const handleImport = async (importedProducts: Product[]) => {
    // TODO: Implement import logic
    toast.success(t("messages.imported", { count: importedProducts.length }));
    router.refresh();
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={products}
        enableRowSelection
        mobileCard={mobileCard}
        bulkActions={bulkActions}
        toolbar={{
          searchKey: "name",
          searchPlaceholder: t("searchPlaceholder"),
          filterableColumns: [
            {
              id: "category",
              title: t("columns.category"),
              options: [
                { label: t("categories.uncategorized"), value: "uncategorized" },
                ...categories,
              ],
            },
            {
              id: "is_active",
              title: t("columns.status"),
              options: [
                { label: t("status.active"), value: "active" },
                { label: t("status.inactive"), value: "inactive" },
              ],
            },
          ],
          onAdd: onAddProduct,
          addLabel: t("addProduct"),
          enableImport: true,
          enableExport: true,
          onImport: handleImport,
        }}
        pageSize={pageSize || 10}
        pageSizeOptions={[10, 20, 50, 100]}
        emptyMessage={t("empty")}
        manualPagination={!!pageCount}
        pageCount={pageCount}
        // Initial state from URL + URL sync callbacks
        initialColumnFilters={initialColumnFilters}
        initialSorting={initialSorting}
        initialPagination={initialPagination}
        onColumnFiltersChange={handleColumnFiltersChange}
        onSortingChange={handleSortingChange}
        onPaginationChange={handlePaginationChangeInternal}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkDeleteIds.length > 0
                ? t("deleteDialog.bulkTitle", { count: bulkDeleteIds.length })
                : t("deleteDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDeleteIds.length > 0
                ? t("deleteDialog.bulkDescription", { count: bulkDeleteIds.length })
                : t("deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
