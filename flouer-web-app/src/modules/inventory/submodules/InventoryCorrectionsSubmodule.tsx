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
import type { InventoryItem, InventoryLocation } from "@/types/inventory";

type AdjustmentDraftLine = {
  id: string;
  itemId: string;
  quantityDelta: number;
  reason: string;
};

type InventoryCorrectionsSubmoduleProps = {
  locations: InventoryLocation[];
  items: InventoryItem[];
  selectedLocationId: string;
  onChangeLocationId: (value: string) => void;
  selectedItemId: string;
  onChangeItemId: (value: string) => void;
  quantityInput: string;
  onChangeQuantityInput: (value: string) => void;
  reasonInput: string;
  onChangeReasonInput: (value: string) => void;
  draftLines: AdjustmentDraftLine[];
  onAddLine: () => void;
  onPostAdjustment: () => void;
};

export function InventoryCorrectionsSubmodule({
  locations,
  items,
  selectedLocationId,
  onChangeLocationId,
  selectedItemId,
  onChangeItemId,
  quantityInput,
  onChangeQuantityInput,
  reasonInput,
  onChangeReasonInput,
  draftLines,
  onAddLine,
  onPostAdjustment,
}: InventoryCorrectionsSubmoduleProps) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const selectedLocationName =
    locations.find((location) => location.id === selectedLocationId)?.name ?? "";
  const selectedItemName = items.find((item) => item.id === selectedItemId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select
          value={selectedLocationId}
          onValueChange={(value) => value && onChangeLocationId(value)}
        >
          <SelectTrigger className="w-full border-black/20">
            <SelectValue placeholder="Location">
              {selectedLocationName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedItemId}
          onValueChange={(value) => value && onChangeItemId(value)}
        >
          <SelectTrigger className="w-full border-black/20">
            <SelectValue placeholder="Item">{selectedItemName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          step="0.001"
          value={quantityInput}
          onChange={(event) => onChangeQuantityInput(event.target.value)}
          className="border-black/20"
          placeholder="Quantity delta"
        />

        <Input
          value={reasonInput}
          onChange={(event) => onChangeReasonInput(event.target.value)}
          className="border-black/20"
          placeholder="Reason"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={onAddLine}
          className="bg-black text-white hover:bg-neutral-800"
        >
          Add Line
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-black/20"
          onClick={onPostAdjustment}
        >
          Post Adjustment
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Delta</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {draftLines.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-neutral-600">
                No draft adjustment lines.
              </TableCell>
            </TableRow>
          ) : (
            draftLines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{itemById.get(line.itemId)?.name ?? line.itemId}</TableCell>
                <TableCell className="text-right">{line.quantityDelta.toFixed(3)}</TableCell>
                <TableCell>{line.reason || "Manual adjustment"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
