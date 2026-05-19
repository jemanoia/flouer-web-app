import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InventoryItem, InventoryLocation, InventoryLowStockAlert } from "@/types/inventory";

type RefillAlertsSubmoduleProps = {
  alerts: InventoryLowStockAlert[];
  items: InventoryItem[];
  locations: InventoryLocation[];
};

export function RefillAlertsSubmodule({
  alerts,
  items,
  locations,
}: RefillAlertsSubmoduleProps) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((location) => [location.id, location]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Location</TableHead>
          <TableHead className="text-right">Current</TableHead>
          <TableHead className="text-right">Threshold</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-neutral-600">
              No active low-stock alerts.
            </TableCell>
          </TableRow>
        ) : (
          alerts.map((alert) => {
            const item = itemById.get(alert.itemId);
            const location = locationById.get(alert.locationId);
            return (
              <TableRow key={alert.id}>
                <TableCell>{item?.name}</TableCell>
                <TableCell>{location?.name}</TableCell>
                <TableCell className="text-right">
                  {alert.currentQuantity.toFixed(3)} {item?.unit}
                </TableCell>
                <TableCell className="text-right">
                  {alert.thresholdQuantity.toFixed(3)} {item?.unit}
                </TableCell>
                <TableCell>
                  <Badge className="border border-black/20 bg-black text-white">
                    Active
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
