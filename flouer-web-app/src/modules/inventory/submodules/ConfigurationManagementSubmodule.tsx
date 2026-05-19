import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { InventoryItem } from "@/types/inventory";

type InventoryConfigItemInput = {
  sku: string;
  name: string;
  itemType: InventoryItem["itemType"];
  unit: InventoryItem["unit"];
  defaultLowStockThreshold: number;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
};

type ConfigurationManagementSubmoduleProps = {
  items: InventoryItem[];
  isSavingItemConfig: boolean;
  onCreateItemConfig: (input: InventoryConfigItemInput) => void | Promise<void>;
  onUpdateItemConfig: (itemId: string, input: InventoryConfigItemInput) => void | Promise<void>;
  onDeleteItemConfig: (itemId: string) => void | Promise<void>;
};

const itemUnits: InventoryItem["unit"][] = ["g", "kg", "ml", "l", "pcs"];

export function ConfigurationManagementSubmodule({
  items,
  isSavingItemConfig,
  onCreateItemConfig,
  onUpdateItemConfig,
  onDeleteItemConfig,
}: ConfigurationManagementSubmoduleProps) {
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState<InventoryItem["unit"]>("kg");
  const [newItemThreshold, setNewItemThreshold] = useState("0");

  const [editingItemId, setEditingItemId] = useState("");
  const [editingItemSku, setEditingItemSku] = useState("");
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemUnit, setEditingItemUnit] = useState<InventoryItem["unit"]>("kg");
  const [editingItemThreshold, setEditingItemThreshold] = useState("0");

  const sortedItems = useMemo(
    () => [...items].filter((item) => item.itemType === "ingredient").sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );

  const handleCreateItem = () => {
    const threshold = Number.parseFloat(newItemThreshold);
    void onCreateItemConfig({
      sku: newItemSku,
      name: newItemName,
      itemType: "ingredient",
      unit: newItemUnit,
      defaultLowStockThreshold: Number.isFinite(threshold) ? threshold : 0,
      isBatchTracked: true,
      isExpiryTracked: true,
    });
    setNewItemSku("");
    setNewItemName("");
    setNewItemUnit("kg");
    setNewItemThreshold("0");
  };

  const startEditItem = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditingItemSku(item.sku);
    setEditingItemName(item.name);
    setEditingItemUnit(item.unit);
    setEditingItemThreshold(item.defaultLowStockThreshold.toString());
  };

  const handleSaveItem = () => {
    if (!editingItemId) return;
    const threshold = Number.parseFloat(editingItemThreshold);
    void onUpdateItemConfig(editingItemId, {
      sku: editingItemSku,
      name: editingItemName,
      itemType: "ingredient",
      unit: editingItemUnit,
      defaultLowStockThreshold: Number.isFinite(threshold) ? threshold : 0,
      isBatchTracked: true,
      isExpiryTracked: true,
    });
    setEditingItemId("");
    setEditingItemSku("");
    setEditingItemName("");
    setEditingItemUnit("kg");
    setEditingItemThreshold("0");
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide">Raw Material Dropdown Values</h3>
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5">
        <Input
          value={newItemSku}
          onChange={(event) => setNewItemSku(event.target.value)}
          placeholder="SKU"
          className="border-black/20"
        />
        <Input
          value={newItemName}
          onChange={(event) => setNewItemName(event.target.value)}
          placeholder="Raw material name"
          className="border-black/20"
        />
        <Select value={newItemUnit} onValueChange={(value) => setNewItemUnit(value as InventoryItem["unit"])}>
          <SelectTrigger className="border-black/20">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            {itemUnits.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="0"
          step="0.001"
          value={newItemThreshold}
          onChange={(event) => setNewItemThreshold(event.target.value)}
          placeholder="Threshold"
          className="border-black/20"
        />
        <Button
          type="button"
          className="bg-black text-white hover:bg-neutral-800"
          onClick={handleCreateItem}
          disabled={isSavingItemConfig}
        >
          {isSavingItemConfig ? "Saving..." : "Add Raw Material"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Threshold</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const isEditing = editingItemId === item.id;
            return (
              <TableRow key={item.id}>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editingItemSku}
                      onChange={(event) => setEditingItemSku(event.target.value)}
                      className="h-8 border-black/20"
                    />
                  ) : (
                    item.sku
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editingItemName}
                      onChange={(event) => setEditingItemName(event.target.value)}
                      className="h-8 border-black/20"
                    />
                  ) : (
                    item.name
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Select
                      value={editingItemUnit}
                      onValueChange={(value) => setEditingItemUnit(value as InventoryItem["unit"])}
                    >
                      <SelectTrigger className="h-8 border-black/20">
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {itemUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    item.unit
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={editingItemThreshold}
                      onChange={(event) => setEditingItemThreshold(event.target.value)}
                      className="h-8 border-black/20 text-right"
                    />
                  ) : (
                    item.defaultLowStockThreshold.toFixed(3)
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        className="h-8 bg-black px-3 text-white hover:bg-neutral-800"
                        onClick={handleSaveItem}
                        disabled={isSavingItemConfig}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 border-black/20 px-3"
                        onClick={() => setEditingItemId("")}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 border-black/20 px-3"
                        onClick={() => startEditItem(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 border-black/20 px-3"
                        onClick={() => void onDeleteItemConfig(item.id)}
                        disabled={isSavingItemConfig}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
