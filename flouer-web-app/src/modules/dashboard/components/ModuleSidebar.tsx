import type { DashboardModule } from "@/modules/dashboard/types";

type ModuleSidebarProps = {
  modules: DashboardModule[];
  selectedModuleId: string;
  onSelectModule: (moduleId: string) => void;
};

export function ModuleSidebar({
  modules,
  selectedModuleId,
  onSelectModule,
}: ModuleSidebarProps) {
  return (
    <aside className="rounded-2xl border border-black/15 bg-white p-4">
      <div className="mb-3 px-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
          Modules
        </h2>
      </div>
      <nav className="space-y-2">
        {modules.map((module) => {
          const isActive = module.id === selectedModuleId;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onSelectModule(module.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-white text-black hover:bg-black/5"
              }`}
            >
              {module.name}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
