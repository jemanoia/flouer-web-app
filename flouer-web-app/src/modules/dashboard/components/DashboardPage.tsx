import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardModules } from "@/modules/dashboard/config/modules";
import { overviewWidgets } from "@/modules/dashboard/config/overview-widgets";
import { ModuleSidebar } from "@/modules/dashboard/components/ModuleSidebar";
import { OverviewWidgetGrid } from "@/modules/dashboard/components/OverviewWidgetGrid";
import { ModulePlaceholderPanel } from "@/modules/dashboard/components/ModulePlaceholderPanel";
import { InventoryModulePanel } from "@/modules/inventory/components/InventoryModulePanel";
import { SalesCheckoutModulePanel } from "@/modules/sales-checkout/components/SalesCheckoutModulePanel";
import { supabase } from "@/utils/supabase";

type DashboardPageProps = {
  session: Session;
};

export function DashboardPage({ session }: DashboardPageProps) {
  const [selectedModuleId, setSelectedModuleId] = useState(dashboardModules[0].id);
  const selectedModule =
    dashboardModules.find((module) => module.id === selectedModuleId) ??
    dashboardModules[0];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <main className="min-h-svh bg-white px-2 py-4 text-black md:px-3 md:py-5">
      <div className="mx-auto flex w-full max-w-none flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-2xl border border-black/15 bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cookie Shop POS Dashboard
            </h1>
            <p className="text-sm text-neutral-600">Welcome, {session.user.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full border-black/20 md:w-auto"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ModuleSidebar
            modules={dashboardModules}
            selectedModuleId={selectedModule.id}
            onSelectModule={setSelectedModuleId}
          />

          <div className="space-y-6">
            <OverviewWidgetGrid widgets={overviewWidgets} />
            {selectedModule.id === "inventory-management" ? (
              <InventoryModulePanel session={session} />
            ) : selectedModule.id === "sales-checkout" ? (
              <SalesCheckoutModulePanel session={session} />
            ) : (
              <ModulePlaceholderPanel module={selectedModule} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
