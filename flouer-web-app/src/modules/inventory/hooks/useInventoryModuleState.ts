import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type {
  InventoryBatch,
  InventoryItem,
  InventoryLocation,
  InventoryItemStock,
  InventoryLowStockAlert,
  InventoryTransfer,
} from "@/types/inventory";
import { getDaysUntil } from "@/modules/inventory/utils/inventoryFormatters";
import { supabase } from "@/utils/supabase";

type AdjustmentDraftLine = {
  id: string;
  itemId: string;
  quantityDelta: number;
  reason: string;
};

type InventoryStockRow = {
  id: string;
  sku: string;
  itemName: string;
  unit: InventoryItem["unit"];
  currentQuantity: number;
  effectiveThreshold: number;
  isLowStock: boolean;
};

type BatchRow = InventoryBatch & {
  itemName: string;
  unit: InventoryItem["unit"];
  locationName: string;
  daysUntilExpiry: number | null;
};

type DbInventoryLocationRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbInventoryItemRow = {
  id: string;
  sku: string;
  name: string;
  item_type: InventoryItem["itemType"];
  unit: InventoryItem["unit"];
  default_low_stock_threshold: number | string;
  is_batch_tracked: boolean;
  is_expiry_tracked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DbInventoryItemStockRow = {
  id: string;
  item_id: string;
  location_id: string;
  current_quantity: number | string;
  low_stock_threshold: number | string | null;
  created_at: string;
  updated_at: string;
};

type DbInventoryBatchRow = {
  id: string;
  item_id: string;
  location_id: string;
  batch_code: string;
  received_at: string;
  expiry_date: string | null;
  quantity_on_hand: number | string;
  unit_cost: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DbInventoryTransferRow = {
  id: string;
  transfer_no: string;
  from_location_id: string;
  to_location_id: string;
  status: InventoryTransfer["status"];
  notes: string | null;
  requested_by: string | null;
  completed_by: string | null;
  requested_at: string;
  completed_at: string | null;
};

type InventoryConfigItemInput = {
  sku: string;
  name: string;
  itemType: InventoryItem["itemType"];
  unit: InventoryItem["unit"];
  defaultLowStockThreshold: number;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
};

type DbInventoryStockMovementRow = {
  id: string;
  item_id: string;
  location_id: string;
  movement_type: "receive" | "adjustment" | "transfer_in" | "transfer_out" | "waste" | "sale_deduction" | "production_use" | "production_return";
  quantity_delta: number | string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
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

type AddIngredientStockInput = {
  itemId: string;
  quantityAdded: number;
  threshold: number;
};

const toNumeric = (value: number | string | null | undefined): number => {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatSupabaseError = (error: unknown, fallbackMessage: string): string => {
  if (!error || typeof error !== "object") return fallbackMessage;

  const typed = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  };

  const parts = [
    typed.message?.trim(),
    typed.code ? `(code: ${typed.code})` : "",
    typed.details?.trim(),
    typed.hint?.trim(),
  ].filter((part) => part && part.length > 0);

  return parts.length > 0 ? parts.join(" ") : fallbackMessage;
};

const mapLocationRow = (row: DbInventoryLocationRow): InventoryLocation => ({
  id: row.id,
  code: row.code,
  name: row.name,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapItemRow = (row: DbInventoryItemRow): InventoryItem => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  itemType: row.item_type,
  unit: row.unit,
  defaultLowStockThreshold: toNumeric(row.default_low_stock_threshold),
  isBatchTracked: row.is_batch_tracked,
  isExpiryTracked: row.is_expiry_tracked,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapItemStockRow = (row: DbInventoryItemStockRow): InventoryItemStock => ({
  id: row.id,
  itemId: row.item_id,
  locationId: row.location_id,
  currentQuantity: toNumeric(row.current_quantity),
  lowStockThreshold:
    row.low_stock_threshold === null ? null : toNumeric(row.low_stock_threshold),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBatchRow = (row: DbInventoryBatchRow): InventoryBatch => ({
  id: row.id,
  itemId: row.item_id,
  locationId: row.location_id,
  batchCode: row.batch_code,
  receivedAt: row.received_at,
  expiryDate: row.expiry_date,
  quantityOnHand: toNumeric(row.quantity_on_hand),
  unitCost: row.unit_cost === null ? null : toNumeric(row.unit_cost),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapTransferRow = (row: DbInventoryTransferRow): InventoryTransfer => ({
  id: row.id,
  transferNo: row.transfer_no,
  fromLocationId: row.from_location_id,
  toLocationId: row.to_location_id,
  status: row.status,
  notes: row.notes,
  requestedBy: row.requested_by,
  completedBy: row.completed_by,
  requestedAt: row.requested_at,
  completedAt: row.completed_at,
});

const mapRestockAuditRow = (
  row: DbInventoryStockMovementRow,
  itemName: string
): RestockAuditRow | null => {
  const added = toNumeric(row.quantity_delta);
  if (added <= 0 || row.movement_type !== "receive") return null;

  let quantityBefore = 0;
  let quantityAfter = added;

  if (row.reason) {
    try {
      const parsed = JSON.parse(row.reason) as {
        quantityBefore?: number | string;
        quantityAdded?: number | string;
        quantityAfter?: number | string;
      };
      const parsedBefore = toNumeric(parsed.quantityBefore);
      const parsedAdded = toNumeric(parsed.quantityAdded);
      const parsedAfter = toNumeric(parsed.quantityAfter);

      quantityBefore = parsedBefore;
      quantityAfter = parsedAfter > 0 ? parsedAfter : parsedBefore + (parsedAdded || added);
    } catch {
      quantityBefore = 0;
      quantityAfter = added;
    }
  }

  return {
    id: row.id,
    itemId: row.item_id,
    itemName,
    quantityBefore,
    quantityAdded: added,
    quantityAfter,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
};

export function useInventoryModuleState(session: Session | null) {
  const [selectedInventoryTab, setSelectedInventoryTab] = useState("stock-tracking");
  const [stockLocationFilter, setStockLocationFilter] = useState("all");
  const [stockSearchTerm, setStockSearchTerm] = useState("");

  const [inventoryLocationRows, setInventoryLocationRows] = useState<InventoryLocation[]>([]);
  const [inventoryItemRows, setInventoryItemRows] = useState<InventoryItem[]>([]);
  const [inventoryBatchRows, setInventoryBatchRows] = useState<InventoryBatch[]>([]);
  const [itemStocks, setItemStocks] = useState<InventoryItemStock[]>([]);
  const [transferRows, setTransferRows] = useState<InventoryTransfer[]>([]);
  const [restockAuditRows, setRestockAuditRows] = useState<RestockAuditRow[]>([]);

  const [isSavingIngredient, setIsSavingIngredient] = useState(false);
  const [isSavingItemConfig, setIsSavingItemConfig] = useState(false);

  const [newIngredientItemId, setNewIngredientItemId] = useState("");
  const [newIngredientLocationId, setNewIngredientLocationId] = useState("");

  const [adjustmentLocationId, setAdjustmentLocationId] = useState("");
  const [adjustmentItemId, setAdjustmentItemId] = useState("");
  const [adjustmentQuantityInput, setAdjustmentQuantityInput] = useState("0");
  const [adjustmentReasonInput, setAdjustmentReasonInput] = useState("");
  const [adjustmentDraftLines, setAdjustmentDraftLines] = useState<AdjustmentDraftLine[]>([]);

  const [transferFromLocationId, setTransferFromLocationId] = useState("");
  const [transferToLocationId, setTransferToLocationId] = useState("");
  const [transferItemId, setTransferItemId] = useState("");
  const [transferQuantityInput, setTransferQuantityInput] = useState("0");
  const [transferNote, setTransferNote] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const locationById = useMemo(
    () => new Map(inventoryLocationRows.map((entry) => [entry.id, entry])),
    [inventoryLocationRows]
  );
  const itemById = useMemo(
    () => new Map(inventoryItemRows.map((entry) => [entry.id, entry])),
    [inventoryItemRows]
  );

  const syncLocationSelections = (locations: InventoryLocation[]) => {
    setNewIngredientLocationId((current) =>
      locations.some((entry) => entry.id === current) ? current : (locations[0]?.id ?? "")
    );
    setAdjustmentLocationId((current) =>
      locations.some((entry) => entry.id === current) ? current : (locations[0]?.id ?? "")
    );
    setTransferFromLocationId((current) =>
      locations.some((entry) => entry.id === current) ? current : (locations[0]?.id ?? "")
    );
    setTransferToLocationId((current) => {
      if (locations.some((entry) => entry.id === current)) return current;
      return locations[1]?.id ?? locations[0]?.id ?? "";
    });
  };

  const syncItemSelections = (items: InventoryItem[]) => {
    setNewIngredientItemId((current) =>
      items.some((entry) => entry.id === current) ? current : (items[0]?.id ?? "")
    );
    setAdjustmentItemId((current) =>
      items.some((entry) => entry.id === current) ? current : (items[0]?.id ?? "")
    );
    setTransferItemId((current) =>
      items.some((entry) => entry.id === current) ? current : (items[0]?.id ?? "")
    );
  };

  useEffect(() => {
    let isActive = true;

    const loadInventoryCoreData = async () => {
      const [
        locationsResult,
        itemsResult,
        stocksResult,
        batchesResult,
        transfersResult,
        movementsResult,
      ] =
        await Promise.all([
          supabase
            .from("inventory_locations")
            .select("id, code, name, is_active, created_at, updated_at")
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("inventory_items")
            .select(
              "id, sku, name, item_type, unit, default_low_stock_threshold, is_batch_tracked, is_expiry_tracked, is_active, created_at, updated_at"
            )
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("inventory_item_stocks")
            .select(
              "id, item_id, location_id, current_quantity, low_stock_threshold, created_at, updated_at"
            ),
          supabase
            .from("inventory_batches")
            .select(
              "id, item_id, location_id, batch_code, received_at, expiry_date, quantity_on_hand, unit_cost, notes, created_at, updated_at"
            ),
          supabase
            .from("inventory_transfers")
            .select(
              "id, transfer_no, from_location_id, to_location_id, status, notes, requested_by, completed_by, requested_at, completed_at"
            )
            .order("requested_at", { ascending: false }),
          supabase
            .from("inventory_stock_movements")
            .select(
              "id, item_id, location_id, movement_type, quantity_delta, reason, created_by, created_at"
            )
            .eq("movement_type", "receive")
            .order("created_at", { ascending: false }),
        ]);

      if (!isActive) return;

      const firstError =
        locationsResult.error ??
        itemsResult.error ??
        stocksResult.error ??
        batchesResult.error ??
        transfersResult.error ??
        movementsResult.error;

      if (firstError) {
        setErrorMessage(
          formatSupabaseError(firstError, "Failed to load inventory data from database.")
        );
        return;
      }

      const dbLocations = (locationsResult.data ?? []).map((row) =>
        mapLocationRow(row as DbInventoryLocationRow)
      );
      const dbItems = (itemsResult.data ?? []).map((row) =>
        mapItemRow(row as DbInventoryItemRow)
      );
      const dbStocks = (stocksResult.data ?? []).map((row) =>
        mapItemStockRow(row as DbInventoryItemStockRow)
      );
      const dbBatches = (batchesResult.data ?? []).map((row) =>
        mapBatchRow(row as DbInventoryBatchRow)
      );
      const dbTransfers = (transfersResult.data ?? []).map((row) =>
        mapTransferRow(row as DbInventoryTransferRow)
      );
      const dbRestockAudits = (movementsResult.data ?? [])
        .map((row) => {
          const typedRow = row as DbInventoryStockMovementRow;
          const itemName =
            dbItems.find((item) => item.id === typedRow.item_id)?.name ?? typedRow.item_id;
          return mapRestockAuditRow(typedRow, itemName);
        })
        .filter((row): row is RestockAuditRow => row !== null);

      setInventoryLocationRows(dbLocations);
      setInventoryItemRows(dbItems);
      setItemStocks(dbStocks);
      setInventoryBatchRows(dbBatches);
      setTransferRows(dbTransfers);
      setRestockAuditRows(dbRestockAudits);
      syncLocationSelections(dbLocations);
      syncItemSelections(dbItems);

      setErrorMessage("");
    };

    void loadInventoryCoreData();

    return () => {
      isActive = false;
    };
  }, [session]);

  const handleCreateItemConfig = async (input: InventoryConfigItemInput) => {
    if (isSavingItemConfig) return;

    const sku = input.sku.trim().toUpperCase();
    const name = input.name.trim();
    if (!sku || !name) {
      setErrorMessage("Item SKU and name are required.");
      return;
    }

    setIsSavingItemConfig(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          sku,
          name,
          item_type: input.itemType,
          unit: input.unit,
          default_low_stock_threshold: Number(input.defaultLowStockThreshold.toFixed(3)),
          is_batch_tracked: input.isBatchTracked,
          is_expiry_tracked: input.isExpiryTracked,
          is_active: true,
        })
        .select(
          "id, sku, name, item_type, unit, default_low_stock_threshold, is_batch_tracked, is_expiry_tracked, is_active, created_at, updated_at"
        )
        .single();

      if (error || !data) throw error ?? new Error("Failed to create item.");

      const mapped = mapItemRow(data as DbInventoryItemRow);
      setInventoryItemRows((previous) => {
        const next = [...previous, mapped].sort((a, b) => a.name.localeCompare(b.name));
        syncItemSelections(next);
        return next;
      });
      setSuccessMessage(`Item "${name}" created.`);
    } catch (error) {
      setErrorMessage(formatSupabaseError(error, "Failed to create item."));
    } finally {
      setIsSavingItemConfig(false);
    }
  };

  const handleUpdateItemConfig = async (itemId: string, input: InventoryConfigItemInput) => {
    if (isSavingItemConfig) return;

    const sku = input.sku.trim().toUpperCase();
    const name = input.name.trim();
    if (!itemId || !sku || !name) {
      setErrorMessage("Item id, SKU, and name are required.");
      return;
    }

    setIsSavingItemConfig(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .update({
          sku,
          name,
          item_type: input.itemType,
          unit: input.unit,
          default_low_stock_threshold: Number(input.defaultLowStockThreshold.toFixed(3)),
          is_batch_tracked: input.isBatchTracked,
          is_expiry_tracked: input.isExpiryTracked,
        })
        .eq("id", itemId)
        .select(
          "id, sku, name, item_type, unit, default_low_stock_threshold, is_batch_tracked, is_expiry_tracked, is_active, created_at, updated_at"
        )
        .single();

      if (error || !data) throw error ?? new Error("Failed to update item.");

      const mapped = mapItemRow(data as DbInventoryItemRow);
      setInventoryItemRows((previous) =>
        previous
          .map((entry) => (entry.id === itemId ? mapped : entry))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setSuccessMessage(`Item "${name}" updated.`);
    } catch (error) {
      setErrorMessage(formatSupabaseError(error, "Failed to update item."));
    } finally {
      setIsSavingItemConfig(false);
    }
  };

  const handleDeleteItemConfig = async (itemId: string) => {
    if (isSavingItemConfig) return;
    if (!itemId) return;

    setIsSavingItemConfig(true);
    setErrorMessage("");
    try {
      const { error } = await supabase
        .from("inventory_items")
        .update({ is_active: false })
        .eq("id", itemId);
      if (error) throw error;

      setInventoryItemRows((previous) => {
        const next = previous.filter((entry) => entry.id !== itemId);
        syncItemSelections(next);
        return next;
      });
      setItemStocks((previous) => previous.filter((entry) => entry.itemId !== itemId));
      setInventoryBatchRows((previous) => previous.filter((entry) => entry.itemId !== itemId));
      setSuccessMessage("Item removed from dropdown values.");
    } catch (error) {
      setErrorMessage(formatSupabaseError(error, "Failed to delete item."));
    } finally {
      setIsSavingItemConfig(false);
    }
  };

  const handleAddIngredient = async (input: AddIngredientStockInput) => {
    if (isSavingIngredient) return;

    const selectedItem = itemById.get(input.itemId);
    const itemName = selectedItem?.name ?? "";
    const addedQuantity = Number(input.quantityAdded);
    const threshold = Number(input.threshold);

    if (!selectedItem) {
      setErrorMessage("Select an item.");
      return;
    }

    if (!Number.isFinite(addedQuantity) || addedQuantity <= 0) {
      setErrorMessage("Quantity is 0. Please enter a value greater than 0.");
      return;
    }

    if (!Number.isFinite(threshold) || threshold < 0) {
      setErrorMessage("Threshold must be zero or greater.");
      return;
    }

    if (!newIngredientLocationId || !locationById.has(newIngredientLocationId)) {
      setErrorMessage("Select a valid location.");
      return;
    }

    setIsSavingIngredient(true);
    setErrorMessage("");

    try {
      const existingStock = itemStocks.find(
        (stock) =>
          stock.itemId === selectedItem.id &&
          stock.locationId === newIngredientLocationId
      );
      const quantityBefore = existingStock?.currentQuantity ?? 0;
      const quantityAfter = Number((quantityBefore + addedQuantity).toFixed(3));

      const { data: upsertedStock, error: upsertStockError } = await supabase
        .from("inventory_item_stocks")
        .upsert(
          {
            item_id: selectedItem.id,
            location_id: newIngredientLocationId,
            current_quantity: quantityAfter,
            low_stock_threshold: Number(threshold.toFixed(3)),
          },
          { onConflict: "item_id,location_id" }
        )
        .select(
          "id, item_id, location_id, current_quantity, low_stock_threshold, created_at, updated_at"
        )
        .single();

      if (upsertStockError || !upsertedStock) {
        throw upsertStockError ?? new Error("Failed to upsert inventory stock.");
      }

      const restockReason = JSON.stringify({
        quantityBefore,
        quantityAdded: Number(addedQuantity.toFixed(3)),
        quantityAfter,
      });

      const { data: movement, error: movementError } = await supabase
        .from("inventory_stock_movements")
        .insert({
          item_id: selectedItem.id,
          location_id: newIngredientLocationId,
          batch_id: null,
          movement_type: "receive",
          quantity_delta: Number(addedQuantity.toFixed(3)),
          reference_type: "raw_material_restock",
          reference_id: null,
          reason: restockReason,
          created_by: session?.user.id ?? null,
        })
        .select("id, item_id, location_id, movement_type, quantity_delta, reason, created_by, created_at")
        .single();

      if (movementError || !movement) {
        throw movementError ?? new Error("Failed to write inventory movement audit.");
      }

      const mappedUpsertedStock = mapItemStockRow(upsertedStock as DbInventoryItemStockRow);
      setItemStocks((previous) => {
        const stockIndex = previous.findIndex((stock) => stock.id === mappedUpsertedStock.id);
        if (stockIndex < 0) return [...previous, mappedUpsertedStock];
        const next = [...previous];
        next[stockIndex] = mappedUpsertedStock;
        return next;
      });
      const auditRow = mapRestockAuditRow(
        movement as DbInventoryStockMovementRow,
        selectedItem.name
      );
      if (auditRow) {
        setRestockAuditRows((previous) => [auditRow, ...previous]);
      }

      setNewIngredientItemId(selectedItem.id);
      setAdjustmentItemId(selectedItem.id);
      setTransferItemId(selectedItem.id);
      setStockLocationFilter("all");
      setStockSearchTerm(itemName);
      setSuccessMessage(`Added ${addedQuantity.toFixed(3)} to "${itemName}".`);
    } catch (error) {
      setErrorMessage(formatSupabaseError(error, "Failed to save ingredient."));
    } finally {
      setIsSavingIngredient(false);
    }
  };

  const lowStockAlerts = useMemo<InventoryLowStockAlert[]>(() => {
    return itemStocks
      .filter((stock) => {
        const item = itemById.get(stock.itemId);
        if (!item) return false;
        const threshold = stock.lowStockThreshold ?? item.defaultLowStockThreshold;
        return stock.currentQuantity <= threshold;
      })
      .map((stock) => {
        const item = itemById.get(stock.itemId);
        const threshold = stock.lowStockThreshold ?? (item?.defaultLowStockThreshold ?? 0);
        return {
          id: `alert-${stock.itemId}-${stock.locationId}`,
          itemId: stock.itemId,
          locationId: stock.locationId,
          thresholdQuantity: threshold,
          currentQuantity: stock.currentQuantity,
          openedAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedBy: null,
        };
      });
  }, [itemById, itemStocks]);

  const stockRows = useMemo<InventoryStockRow[]>(() => {
    const grouped = new Map<string, InventoryStockRow>();

    for (const stock of itemStocks) {
      const item = itemById.get(stock.itemId);
      if (!item) continue;

      const existing = grouped.get(stock.itemId);
      const threshold = item.defaultLowStockThreshold;

      if (!existing) {
        grouped.set(stock.itemId, {
          id: stock.itemId,
          sku: item.sku,
          itemName: item.name,
          unit: item.unit,
          currentQuantity: Number(stock.currentQuantity.toFixed(3)),
          effectiveThreshold: Number(threshold.toFixed(3)),
          isLowStock: stock.currentQuantity <= threshold,
        });
        continue;
      }

      const nextQty = Number((existing.currentQuantity + stock.currentQuantity).toFixed(3));
      existing.currentQuantity = nextQty;
      existing.isLowStock = nextQty <= existing.effectiveThreshold;
      grouped.set(stock.itemId, existing);
    }

    return [...grouped.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [itemById, itemStocks, locationById]);

  const filteredStockRows = useMemo(() => {
    const normalizedSearch = stockSearchTerm.trim().toLowerCase();

    return stockRows.filter((row) => {
      const textMatch =
        normalizedSearch.length === 0 ||
        row.itemName.toLowerCase().includes(normalizedSearch) ||
        row.sku.toLowerCase().includes(normalizedSearch);

      return textMatch;
    });
  }, [stockLocationFilter, stockRows, stockSearchTerm]);

  const batchRows = useMemo<BatchRow[]>(() => {
    return inventoryBatchRows
      .map((batch) => {
        const item = itemById.get(batch.itemId);
        const location = locationById.get(batch.locationId);
        if (!item || !location) return null;

        const daysUntilExpiry = getDaysUntil(batch.expiryDate);
        return {
          ...batch,
          itemName: item.name,
          unit: item.unit,
          locationName: location.name,
          daysUntilExpiry,
        };
      })
      .filter((row): row is BatchRow => row !== null)
      .sort((a, b) => {
        const aDays = a.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.daysUntilExpiry ?? Number.MAX_SAFE_INTEGER;
        return aDays - bDays;
      });
  }, [inventoryBatchRows, itemById, locationById]);

  const handleAddAdjustmentLine = () => {
    const quantity = Number.parseFloat(adjustmentQuantityInput);
    if (!Number.isFinite(quantity) || quantity === 0) {
      setErrorMessage("Adjustment quantity must be a non-zero number.");
      return;
    }

    if (!adjustmentItemId || !adjustmentLocationId) {
      setErrorMessage("Select item and location before adding an adjustment line.");
      return;
    }

    setAdjustmentDraftLines((previous) => [
      ...previous,
      {
        id: `adj-line-${Date.now()}-${previous.length + 1}`,
        itemId: adjustmentItemId,
        quantityDelta: quantity,
        reason: adjustmentReasonInput.trim(),
      },
    ]);

    setAdjustmentQuantityInput("0");
    setAdjustmentReasonInput("");
    setErrorMessage("");
  };

  const handlePostAdjustment = () => {
    if (adjustmentDraftLines.length === 0) {
      setErrorMessage("Add at least one adjustment line before posting.");
      return;
    }

    let hasError = false;
    let failureMessage = "";

    setItemStocks((previous) => {
      const next = [...previous];

      for (const line of adjustmentDraftLines) {
        const index = next.findIndex(
          (stock) => stock.itemId === line.itemId && stock.locationId === adjustmentLocationId
        );

        if (index < 0) {
          if (line.quantityDelta < 0) {
            hasError = true;
            failureMessage =
              "Cannot post negative adjustment for stock record that does not exist.";
            return previous;
          }

          next.push({
            id: `stk-${Date.now()}-${line.itemId}`,
            itemId: line.itemId,
            locationId: adjustmentLocationId,
            currentQuantity: line.quantityDelta,
            lowStockThreshold: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          continue;
        }

        const newQuantity = next[index].currentQuantity + line.quantityDelta;
        if (newQuantity < 0) {
          hasError = true;
          failureMessage = "Adjustment would result in negative stock quantity.";
          return previous;
        }

        next[index] = {
          ...next[index],
          currentQuantity: Number(newQuantity.toFixed(3)),
          updatedAt: new Date().toISOString(),
        };
      }

      return next;
    });

    if (hasError) {
      setErrorMessage(failureMessage);
      return;
    }

    setSuccessMessage("Stock adjustment posted to inventory view.");
    setErrorMessage("");
    setAdjustmentDraftLines([]);
  };

  const handleCreateTransfer = () => {
    const quantity = Number.parseFloat(transferQuantityInput);

    if (!transferFromLocationId || !transferToLocationId || !transferItemId) {
      setErrorMessage("Select source, destination, and item before drafting transfer.");
      return;
    }

    if (transferFromLocationId === transferToLocationId) {
      setErrorMessage("Transfer source and destination must be different.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorMessage("Transfer quantity must be greater than zero.");
      return;
    }

    const transferNo = `TRF-${new Date().getUTCFullYear()}-${String(
      transferRows.length + 1
    ).padStart(4, "0")}`;

    const transfer: InventoryTransfer = {
      id: `trf-${Date.now()}`,
      transferNo,
      fromLocationId: transferFromLocationId,
      toLocationId: transferToLocationId,
      status: "draft",
      notes: transferNote.trim() || null,
      requestedBy: session?.user.id ?? null,
      completedBy: null,
      requestedAt: new Date().toISOString(),
      completedAt: null,
    };

    setTransferRows((previous) => [transfer, ...previous]);
    setTransferQuantityInput("0");
    setTransferNote("");
    setSuccessMessage(`Transfer ${transferNo} drafted for ${quantity.toFixed(3)} units.`);
    setErrorMessage("");

    setItemStocks((previous) => {
      const next = [...previous];

      const fromIndex = next.findIndex(
        (stock) => stock.itemId === transferItemId && stock.locationId === transferFromLocationId
      );

      if (fromIndex >= 0) {
        const nextQuantity = next[fromIndex].currentQuantity - quantity;
        if (nextQuantity >= 0) {
          next[fromIndex] = {
            ...next[fromIndex],
            currentQuantity: Number(nextQuantity.toFixed(3)),
            updatedAt: new Date().toISOString(),
          };
        }
      }

      const toIndex = next.findIndex(
        (stock) => stock.itemId === transferItemId && stock.locationId === transferToLocationId
      );

      if (toIndex >= 0) {
        next[toIndex] = {
          ...next[toIndex],
          currentQuantity: Number((next[toIndex].currentQuantity + quantity).toFixed(3)),
          updatedAt: new Date().toISOString(),
        };
      } else {
        next.push({
          id: `stk-${Date.now()}-trf`,
          itemId: transferItemId,
          locationId: transferToLocationId,
          currentQuantity: Number(quantity.toFixed(3)),
          lowStockThreshold: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      return next;
    });
  };

  return {
    inventoryLocations: inventoryLocationRows,
    inventoryItems: inventoryItemRows,
    locationById,
    itemById,
    selectedInventoryTab,
    setSelectedInventoryTab,
    stockLocationFilter,
    setStockLocationFilter,
    stockSearchTerm,
    setStockSearchTerm,
    newIngredientItemId,
    setNewIngredientItemId,
    newIngredientLocationId,
    isSavingIngredient,
    handleAddIngredient,
    filteredStockRows,
    restockAuditRows,
    lowStockAlerts,
    batchRows,
    adjustmentLocationId,
    setAdjustmentLocationId,
    adjustmentItemId,
    setAdjustmentItemId,
    adjustmentQuantityInput,
    setAdjustmentQuantityInput,
    adjustmentReasonInput,
    setAdjustmentReasonInput,
    adjustmentDraftLines,
    handleAddAdjustmentLine,
    handlePostAdjustment,
    transferFromLocationId,
    setTransferFromLocationId,
    transferToLocationId,
    setTransferToLocationId,
    transferItemId,
    setTransferItemId,
    transferQuantityInput,
    setTransferQuantityInput,
    transferNote,
    setTransferNote,
    transferRows,
    handleCreateTransfer,
    isSavingItemConfig,
    handleCreateItemConfig,
    handleUpdateItemConfig,
    handleDeleteItemConfig,
    inventoryErrorMessage: errorMessage,
    inventorySuccessMessage: successMessage,
    clearInventoryMessages: () => {
      setErrorMessage("");
      setSuccessMessage("");
    },
  };
}
