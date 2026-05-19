import { Badge } from "@/components/ui/badge";
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
import type { InventoryItem, InventoryLocation, InventoryTransfer } from "@/types/inventory";
import { formatDateTime } from "@/modules/inventory/utils/inventoryFormatters";

type MoveStockSubmoduleProps = {
  locations: InventoryLocation[];
  items: InventoryItem[];
  transfers: InventoryTransfer[];
  fromLocationId: string;
  onChangeFromLocationId: (value: string) => void;
  toLocationId: string;
  onChangeToLocationId: (value: string) => void;
  itemId: string;
  onChangeItemId: (value: string) => void;
  quantityInput: string;
  onChangeQuantityInput: (value: string) => void;
  note: string;
  onChangeNote: (value: string) => void;
  onCreateTransfer: () => void;
};

export function MoveStockSubmodule({
  locations,
  items,
  transfers,
  fromLocationId,
  onChangeFromLocationId,
  toLocationId,
  onChangeToLocationId,
  itemId,
  onChangeItemId,
  quantityInput,
  onChangeQuantityInput,
  note,
  onChangeNote,
  onCreateTransfer,
}: MoveStockSubmoduleProps) {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const fromLocationName = locationById.get(fromLocationId)?.name ?? "";
  const toLocationName = locationById.get(toLocationId)?.name ?? "";
  const itemName = items.find((item) => item.id === itemId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Select
          value={fromLocationId}
          onValueChange={(value) => value && onChangeFromLocationId(value)}
        >
          <SelectTrigger className="w-full border-black/20">
            <SelectValue placeholder="From">{fromLocationName}</SelectValue>
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
          value={toLocationId}
          onValueChange={(value) => value && onChangeToLocationId(value)}
        >
          <SelectTrigger className="w-full border-black/20">
            <SelectValue placeholder="To">{toLocationName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={itemId} onValueChange={(value) => value && onChangeItemId(value)}>
          <SelectTrigger className="w-full border-black/20">
            <SelectValue placeholder="Item">{itemName}</SelectValue>
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
          placeholder="Quantity"
          className="border-black/20"
        />

        <Button
          type="button"
          className="bg-black text-white hover:bg-neutral-800"
          onClick={onCreateTransfer}
        >
          Draft Transfer
        </Button>
      </div>

      <Input
        value={note}
        onChange={(event) => onChangeNote(event.target.value)}
        placeholder="Transfer note"
        className="border-black/20"
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transfer No</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((transfer) => (
            <TableRow key={transfer.id}>
              <TableCell>{transfer.transferNo}</TableCell>
              <TableCell>{locationById.get(transfer.fromLocationId)?.name}</TableCell>
              <TableCell>{locationById.get(transfer.toLocationId)?.name}</TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className="border border-black/10 bg-black/5 text-black"
                >
                  {transfer.status}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(transfer.requestedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
