import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OverviewWidget } from "@/modules/dashboard/types";

type OverviewWidgetGridProps = {
  widgets: OverviewWidget[];
};

export function OverviewWidgetGrid({ widgets }: OverviewWidgetGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {widgets.map((widget) => (
        <Card key={widget.label} className="border-black/15 shadow-none">
          <CardHeader className="pb-2">
            <CardDescription className="text-neutral-600">{widget.label}</CardDescription>
            <CardTitle className="text-xl tracking-tight">{widget.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </section>
  );
}
