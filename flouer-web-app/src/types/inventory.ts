export type InventoryUnit = "g" | "kg" | "ml" | "l" | "pcs";

export type InventoryItemType = "ingredient" | "packaging" | "consumable";

export type InventoryMovementType =
  | "receive"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "waste"
  | "sale_deduction"
  | "production_use"
  | "production_return";

export type InventoryAdjustmentStatus = "draft" | "posted" | "cancelled";

export type InventoryTransferStatus = "draft" | "in_transit" | "completed" | "cancelled";

export interface InventoryLocation {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  itemType: InventoryItemType;
  unit: InventoryUnit;
  defaultLowStockThreshold: number;
  isBatchTracked: boolean;
  isExpiryTracked: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemStock {
  id: string;
  itemId: string;
  locationId: string;
  currentQuantity: number;
  lowStockThreshold: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatch {
  id: string;
  itemId: string;
  locationId: string;
  batchCode: string;
  receivedAt: string;
  expiryDate: string | null;
  quantityOnHand: number;
  unitCost: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStockMovement {
  id: string;
  itemId: string;
  locationId: string;
  batchId: string | null;
  movementType: InventoryMovementType;
  quantityDelta: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface InventoryStockAdjustment {
  id: string;
  locationId: string;
  status: InventoryAdjustmentStatus;
  reason: string | null;
  notes: string | null;
  createdBy: string | null;
  postedBy: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface InventoryStockAdjustmentLine {
  id: string;
  adjustmentId: string;
  itemId: string;
  batchId: string | null;
  quantityDelta: number;
  note: string | null;
}

export interface InventoryTransfer {
  id: string;
  transferNo: string;
  fromLocationId: string;
  toLocationId: string;
  status: InventoryTransferStatus;
  notes: string | null;
  requestedBy: string | null;
  completedBy: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface InventoryTransferLine {
  id: string;
  transferId: string;
  itemId: string;
  sourceBatchId: string | null;
  quantity: number;
  note: string | null;
}

export interface InventoryLowStockAlert {
  id: string;
  itemId: string;
  locationId: string;
  thresholdQuantity: number;
  currentQuantity: number;
  openedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface InventoryStockSnapshot {
  itemId: string;
  sku: string;
  itemName: string;
  unit: InventoryUnit;
  locationId: string;
  locationCode: string;
  locationName: string;
  currentQuantity: number;
  effectiveLowStockThreshold: number;
  isLowStock: boolean;
}
