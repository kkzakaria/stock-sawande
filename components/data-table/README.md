# DataTable Component

Composant DataTable réutilisable et générique basé sur TanStack Table et shadcn/ui.

## Fonctionnalités

✅ **Générique et typé** - Fonctionne avec n'importe quel type de données
✅ **Recherche** - Recherche globale dans les colonnes
✅ **Filtres** - Filtres multi-sélection par colonnes
✅ **Tri** - Tri multi-colonnes ascendant/descendant
✅ **Pagination** - Contrôles de navigation et sélection de taille de page
✅ **Sélection de lignes** - Sélection multiple avec checkboxes
✅ **Visibilité des colonnes** - Toggle pour afficher/masquer
✅ **Import/Export** - CSV et Excel
✅ **Actions personnalisables** - Boutons et actions par ligne
✅ **États** - Loading, empty, error
✅ **Responsive** - Design adaptatif

## Installation

Les dépendances sont déjà installées dans le projet :

```bash
@tanstack/react-table
papaparse
xlsx
```

## Utilisation de base

```typescript
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";

// 1. Définir vos données
type Product = {
  id: string;
  name: string;
  price: number;
  status: "active" | "inactive";
};

const data: Product[] = [...];

// 2. Définir vos colonnes
const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("price"));
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(price);
    },
  },
  {
    accessorKey: "status",
    header: "Status",
  },
];

// 3. Utiliser le composant
export function ProductsTable() {
  return (
    <DataTable
      columns={columns}
      data={data}
    />
  );
}
```

## Utilisation avancée

### Avec recherche et filtres

```typescript
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

const columns: ColumnDef<Product>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
];

export function ProductsTable() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleImport = async (data: Product[]) => {
    // Valider et importer les données
    await importProducts(data);
  };

  return (
    <DataTable
      columns={columns}
      data={data}
      enableRowSelection
      toolbar={{
        searchKey: "name",
        searchPlaceholder: "Search products...",
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
        onAdd: () => setIsAddDialogOpen(true),
        addLabel: "Add Product",
        enableImport: true,
        enableExport: true,
        onImport: handleImport,
      }}
      pageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
    />
  );
}
```

### Avec actions par ligne

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash } from "lucide-react";

const columns: ColumnDef<Product>[] = [
  // ... autres colonnes
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleEdit(product)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(product.id)}
              className="text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
```

### Avec sélection et actions groupées

```typescript
export function ProductsTable() {
  const [selectedRows, setSelectedRows] = useState<Product[]>([]);

  const handleBulkDelete = async () => {
    const ids = selectedRows.map(row => row.id);
    await deleteProducts(ids);
  };

  return (
    <>
      {selectedRows.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selectedRows.length} row(s) selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
          >
            Delete selected
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        enableRowSelection
        onRowSelectionChange={setSelectedRows}
      />
    </>
  );
}
```

## Props

### DataTableProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `ColumnDef<TData, TValue>[]` | **required** | Définitions des colonnes |
| `data` | `TData[]` | **required** | Données à afficher |
| `toolbar` | `DataTableToolbarConfig` | `undefined` | Configuration de la toolbar |
| `pageSize` | `number` | `10` | Nombre d'items par page |
| `pageSizeOptions` | `number[]` | `[10, 20, 30, 40, 50]` | Options de taille de page |
| `enablePagination` | `boolean` | `true` | Activer la pagination |
| `enableRowSelection` | `boolean` | `false` | Activer la sélection de lignes |
| `enableSorting` | `boolean` | `true` | Activer le tri |
| `enableColumnVisibility` | `boolean` | `true` | Activer la visibilité des colonnes |
| `isLoading` | `boolean` | `false` | État de chargement |
| `emptyMessage` | `string` | `"No results."` | Message si aucune donnée |
| `getRowId` | `(row: TData) => string` | `undefined` | Fonction pour obtenir l'ID de ligne |
| `onRowSelectionChange` | `(rows: TData[]) => void` | `undefined` | Callback de sélection |

### DataTableToolbarConfig

| Prop | Type | Description |
|------|------|-------------|
| `searchKey` | `string` | Colonne pour la recherche |
| `searchPlaceholder` | `string` | Placeholder de recherche |
| `filterableColumns` | `FilterableColumn[]` | Colonnes filtrables |
| `onAdd` | `() => void` | Callback du bouton Add |
| `addLabel` | `string` | Label du bouton Add |
| `onImport` | `(data: TData[]) => Promise<void>` | Callback d'import |
| `enableExport` | `boolean` | Activer l'export |
| `enableImport` | `boolean` | Activer l'import |

## Exemples d'utilisation dans le projet

- **Products Table** : `/components/products/products-data-table.tsx`
- **Sales Table** : `/components/sales/sales-data-table.tsx`
- **Stores Table** : `/components/stores/stores-data-table.tsx`

## Export/Import

### Export

Le composant supporte l'export en CSV et Excel. Utilisez le bouton "Export" dans la toolbar.

- Export toutes les lignes filtrées
- Export des lignes sélectionnées si une sélection existe
- Format CSV par défaut

### Import

Le composant supporte l'import depuis CSV et Excel. Utilisez le bouton "Import" dans la toolbar.

```typescript
const handleImport = async (data: Product[]) => {
  // Valider les données
  const validated = validateProducts(data);

  // Sauvegarder
  await saveProducts(validated);

  // Rafraîchir
  revalidatePath("/products");
};
```

## Styling

Le composant utilise le style shadcn "new-york" avec Tailwind CSS. Toutes les classes sont personnalisables.

## Performance

- Utilise la virtualisation pour grandes listes (via TanStack Table)
- Filtrage et tri optimisés côté client
- Pagination pour réduire le rendu
- Memoization des colonnes recommandée

## Accessibilité

- Navigation au clavier
- ARIA labels
- Screen reader support
- Focus management

## License

MIT
