import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/modules/inventory/utils/inventoryFormatters";
import type { InventoryItem } from "@/types/inventory";

const addStockSchema = z.object({
  itemId: z.string().min(1, "Raw material is required."),
  quantityAdded: z.string().refine((value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0;
  }, {
      message: "Quantity is 0. Please enter a value greater than 0.",
    }),
  threshold: z.string().refine((value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, {
      message: "Threshold must be zero or greater.",
    }),
});

type AddStockFormValues = z.infer<typeof addStockSchema>;

type StockRow = {
  id: string;
  sku: string;
  itemName: string;
  unit: string;
  currentQuantity: number;
  effectiveThreshold: number;
  isLowStock: boolean;
};

type RestockAuditRow = {
  id: string;
  itemId: string;
  itemName: string;
  quantityBefore: number;
  quantityAdded: number;
  quantityAfter: number;
  createdAt: string;
  createdBy: string | null;
};

type IngredientsTrackingSubmoduleProps = {
  items: InventoryItem[];
  selectedItemId: string;
  isAddingIngredient: boolean;
  onAddIngredient: (input: {
    itemId: string;
    quantityAdded: number;
    threshold: number;
  }) => void | Promise<void>;
  searchTerm: string;
  onChangeSearchTerm: (value: string) => void;
  rows: StockRow[];
  auditRows: RestockAuditRow[];
};

export function IngredientsTrackingSubmodule({
  items,
  selectedItemId,
  isAddingIngredient,
  onAddIngredient,
  searchTerm,
  onChangeSearchTerm,
  rows,
  auditRows,
}: IngredientsTrackingSubmoduleProps) {
  const form = useForm<AddStockFormValues>({
    resolver: zodResolver(addStockSchema),
    defaultValues: {
      itemId: selectedItemId,
      quantityAdded: "0",
      threshold: "0",
    },
  });

  useEffect(() => {
    const currentItemId = form.getValues("itemId");
    if (!currentItemId && selectedItemId) {
      form.setValue("itemId", selectedItemId, { shouldValidate: false });
    }
  }, [form, selectedItemId]);

  const onSubmit = async (values: AddStockFormValues) => {
    await onAddIngredient({
      itemId: values.itemId,
      quantityAdded: Number.parseFloat(values.quantityAdded),
      threshold: Number.parseFloat(values.threshold),
    });
    form.reset({
      itemId: values.itemId,
      quantityAdded: "0",
      threshold: values.threshold,
    });
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <FormField
            control={form.control}
            name="itemId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Raw Material</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full border-black/20">
                      <SelectValue placeholder="Select raw material" />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter((item) => item.itemType === "ingredient")
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantityAdded"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    className="border-black/20"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threshold</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    className="border-black/20"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel className="opacity-0">Action</FormLabel>
            <Button
              type="submit"
              disabled={isAddingIngredient}
              className="w-full bg-black text-white hover:bg-neutral-800"
            >
              {isAddingIngredient ? "Saving..." : "Add Stock"}
            </Button>
          </FormItem>
        </form>
      </Form>

      <Input
        value={searchTerm}
        onChange={(event) => onChangeSearchTerm(event.target.value)}
        placeholder="Search by item or SKU"
        className="border-black/20"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Raw Material</TableHead>
            <TableHead className="text-right">On Hand</TableHead>
            <TableHead className="text-right">Threshold</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.sku}</TableCell>
              <TableCell>{row.itemName}</TableCell>
              <TableCell className="text-right">
                {row.currentQuantity.toFixed(3)} {row.unit}
              </TableCell>
              <TableCell className="text-right">
                {row.effectiveThreshold.toFixed(3)} {row.unit}
              </TableCell>
              <TableCell>
                {row.isLowStock ? (
                  <Badge className="border border-black/20 bg-black text-white">Low Stock</Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="border border-black/10 bg-black/5 text-black"
                  >
                    Healthy
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide">Restock Audit History</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Raw Material</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">Added</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Added At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-600">
                  No restock history yet.
                </TableCell>
              </TableRow>
            ) : (
              auditRows.map((audit) => (
                <TableRow key={audit.id}>
                  <TableCell>{audit.itemName}</TableCell>
                  <TableCell className="text-right">{audit.quantityBefore.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{audit.quantityAdded.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{audit.quantityAfter.toFixed(3)}</TableCell>
                  <TableCell>{formatDateTime(audit.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
