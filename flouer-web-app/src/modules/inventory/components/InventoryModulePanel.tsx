import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Session } from "@supabase/supabase-js";
import { useInventoryModuleState } from "@/modules/inventory/hooks/useInventoryModuleState";
import { IngredientsTrackingSubmodule } from "@/modules/inventory/submodules/IngredientsTrackingSubmodule";
import { InventoryCorrectionsSubmodule } from "@/modules/inventory/submodules/InventoryCorrectionsSubmodule";
import { RefillAlertsSubmodule } from "@/modules/inventory/submodules/RefillAlertsSubmodule";
import { MoveStockSubmodule } from "@/modules/inventory/submodules/MoveStockSubmodule";
import { FreshnessExpirySubmodule } from "@/modules/inventory/submodules/FreshnessExpirySubmodule";
import { ConfigurationManagementSubmodule } from "@/modules/inventory/submodules/ConfigurationManagementSubmodule";

type InventoryModulePanelProps = {
  session: Session | null;
};

export function InventoryModulePanel({ session }: InventoryModulePanelProps) {
  const state = useInventoryModuleState(session);

  return (
    <Card className="border-black/15 shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight">Inventory Management</CardTitle>
        <CardDescription className="text-neutral-600">
          Track ingredients, correct counts, see refill warnings, move stock, and monitor freshness.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.inventoryErrorMessage && (
          <p className="text-sm text-black">{state.inventoryErrorMessage}</p>
        )}
        {state.inventorySuccessMessage && (
          <p className="text-sm text-black">{state.inventorySuccessMessage}</p>
        )}

        <Tabs
          value={state.selectedInventoryTab}
          onValueChange={state.setSelectedInventoryTab}
        >
          <TabsList className="mb-4 w-full justify-start overflow-x-auto" variant="line">
            <TabsTrigger value="stock-tracking">Ingredients Tracking</TabsTrigger>
            <TabsTrigger value="stock-adjustments">Inventory Corrections</TabsTrigger>
            <TabsTrigger value="low-stock-alerts">Refill Alerts</TabsTrigger>
            <TabsTrigger value="stock-transfers">Move Stock</TabsTrigger>
            <TabsTrigger value="batch-expiry">Freshness & Expiry</TabsTrigger>
            <TabsTrigger value="configuration-management">Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="stock-tracking">
            <IngredientsTrackingSubmodule
              items={state.inventoryItems}
              selectedItemId={state.newIngredientItemId}
              isAddingIngredient={state.isSavingIngredient}
              onAddIngredient={state.handleAddIngredient}
              searchTerm={state.stockSearchTerm}
              onChangeSearchTerm={state.setStockSearchTerm}
              rows={state.filteredStockRows}
              auditRows={state.restockAuditRows}
            />
          </TabsContent>

          <TabsContent value="stock-adjustments">
            <InventoryCorrectionsSubmodule
              locations={state.inventoryLocations}
              items={state.inventoryItems}
              selectedLocationId={state.adjustmentLocationId}
              onChangeLocationId={state.setAdjustmentLocationId}
              selectedItemId={state.adjustmentItemId}
              onChangeItemId={state.setAdjustmentItemId}
              quantityInput={state.adjustmentQuantityInput}
              onChangeQuantityInput={state.setAdjustmentQuantityInput}
              reasonInput={state.adjustmentReasonInput}
              onChangeReasonInput={state.setAdjustmentReasonInput}
              draftLines={state.adjustmentDraftLines}
              onAddLine={state.handleAddAdjustmentLine}
              onPostAdjustment={state.handlePostAdjustment}
            />
          </TabsContent>

          <TabsContent value="low-stock-alerts">
            <RefillAlertsSubmodule
              alerts={state.lowStockAlerts}
              items={state.inventoryItems}
              locations={state.inventoryLocations}
            />
          </TabsContent>

          <TabsContent value="stock-transfers">
            <MoveStockSubmodule
              locations={state.inventoryLocations}
              items={state.inventoryItems}
              transfers={state.transferRows}
              fromLocationId={state.transferFromLocationId}
              onChangeFromLocationId={state.setTransferFromLocationId}
              toLocationId={state.transferToLocationId}
              onChangeToLocationId={state.setTransferToLocationId}
              itemId={state.transferItemId}
              onChangeItemId={state.setTransferItemId}
              quantityInput={state.transferQuantityInput}
              onChangeQuantityInput={state.setTransferQuantityInput}
              note={state.transferNote}
              onChangeNote={state.setTransferNote}
              onCreateTransfer={state.handleCreateTransfer}
            />
          </TabsContent>

          <TabsContent value="batch-expiry">
            <FreshnessExpirySubmodule rows={state.batchRows} />
          </TabsContent>

          <TabsContent value="configuration-management">
            <ConfigurationManagementSubmodule
              items={state.inventoryItems}
              isSavingItemConfig={state.isSavingItemConfig}
              onCreateItemConfig={state.handleCreateItemConfig}
              onUpdateItemConfig={state.handleUpdateItemConfig}
              onDeleteItemConfig={state.handleDeleteItemConfig}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
