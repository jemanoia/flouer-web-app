import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getExpiryLabel } from "@/modules/inventory/utils/inventoryFormatters";

type BatchRow = {
  id: string;
  batchCode: string;
  itemName: string;
  locationName: string;
  quantityOnHand: number;
  unit: string;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
};

type FreshnessExpirySubmoduleProps = {
  rows: BatchRow[];
};

export function FreshnessExpirySubmodule({ rows }: FreshnessExpirySubmoduleProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead>Expiry Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((batch) => (
          <TableRow key={batch.id}>
            <TableCell>{batch.batchCode}</TableCell>
            <TableCell>{batch.itemName}</TableCell>
            <TableCell>{batch.locationName}</TableCell>
            <TableCell className="text-right">
              {batch.quantityOnHand.toFixed(3)} {batch.unit}
            </TableCell>
            <TableCell>{batch.expiryDate ?? "N/A"}</TableCell>
            <TableCell>
              <Badge
                className={
                  batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 7
                    ? "border border-black/20 bg-black text-white"
                    : "border border-black/10 bg-black/5 text-black"
                }
              >
                {getExpiryLabel(batch.daysUntilExpiry)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
