"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { CURRENCY_CONFIG } from '@/lib/config/currency'
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { ColumnDef, type ColumnFiltersState, type SortingState } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle2, XCircle } from "lucide-react";
import { StockQuantityPopover } from "./stock-quantity-popover";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table";
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
        const formatted = new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(price);
        return `${formatted} ${CURRENCY_CONFIG.symbol}`;
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
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDialog.description")}
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
