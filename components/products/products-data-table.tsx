"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, Eye, CheckCircle2, XCircle } from "lucide-react";
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

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  quantity: number;
  min_stock_level: number | null;
  is_active: boolean | null;
  barcode: string | null;
  image_url: string | null;
  categories: { id: string; name: string } | null;
  stores: { id: string; name: string } | null;
}

interface ProductsDataTableProps {
  products: Product[];
  onAddProduct?: () => void;
  pageCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
}

export function ProductsDataTable({
  products,
  onAddProduct,
  pageCount,
  pageSize,
  onPaginationChange,
}: ProductsDataTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!productToDelete) return;

    startTransition(async () => {
      const result = await deleteProduct(productToDelete);
      if (result.success) {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        toast.success("Product deleted successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete product");
      }
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleProductStatus(id, !currentStatus);
      if (result.success) {
        toast.success(`Product ${!currentStatus ? "activated" : "deactivated"}`);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update product status");
      }
    });
  };

  const confirmDelete = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStockBadge = (quantity: number, minLevel: number | null) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (minLevel !== null && quantity <= minLevel) {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-500">
          Low Stock
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-green-500 text-green-500">
        In Stock
      </Badge>
    );
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
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: ({ row }) => {
        const imageUrl = row.original.image_url;
        const name = row.getValue("name") as string;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={name || "Product"}
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
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.getValue("sku")}</span>
      ),
    },
    {
      accessorKey: "categories.name",
      id: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => {
        const category = row.original.categories?.name;
        return <span>{category || "Uncategorized"}</span>;
      },
      filterFn: (row, id, value) => {
        return value.includes(row.original.categories?.name || "uncategorized");
      },
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Price" />
      ),
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("price"));
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(price);
      },
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Quantity" />
      ),
      cell: ({ row }) => {
        const quantity = row.getValue("quantity") as number;
        const minLevel = row.original.min_stock_level;
        return (
          <div className="flex items-center gap-2">
            <span>{quantity}</span>
            {getStockBadge(quantity, minLevel)}
          </div>
        );
      },
    },
    {
      accessorKey: "stores.name",
      id: "store",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Store" />
      ),
      cell: ({ row }) => {
        const store = row.original.stores?.name;
        return <span>{store || "No Store"}</span>;
      },
    },
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const isActive = row.getValue("is_active");
        return isActive ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
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
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/products/${product.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/products/${product.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  handleToggleStatus(product.id, product.is_active ?? false)
                }
                disabled={isPending}
              >
                {product.is_active ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => confirmDelete(product.id)}
                className="text-destructive"
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Collect unique categories for filters
  const categories = Array.from(
    new Set(products.map((p) => p.categories?.name).filter(Boolean))
  ).map((name) => ({
    label: name!,
    value: name!,
  }));

  const handleImport = async (importedProducts: Product[]) => {
    // TODO: Implement import logic
    toast.success(`Imported ${importedProducts.length} products`);
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
          searchPlaceholder: "Search products...",
          filterableColumns: [
            {
              id: "category",
              title: "Category",
              options: [
                { label: "Uncategorized", value: "uncategorized" },
                ...categories,
              ],
            },
            {
              id: "is_active",
              title: "Status",
              options: [
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ],
            },
          ],
          onAdd: onAddProduct,
          addLabel: "Add Product",
          enableImport: true,
          enableExport: true,
          onImport: handleImport,
        }}
        pageSize={pageSize || 10}
        pageSizeOptions={[10, 20, 50, 100]}
        emptyMessage="No products found. Add your first product to get started."
        manualPagination={!!pageCount}
        pageCount={pageCount}
        onPaginationChange={onPaginationChange}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              product and all associated stock movements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
