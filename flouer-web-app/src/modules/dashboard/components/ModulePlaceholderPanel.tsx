import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DashboardModule } from "@/modules/dashboard/types";

type ModulePlaceholderPanelProps = {
  module: DashboardModule;
};

export function ModulePlaceholderPanel({ module }: ModulePlaceholderPanelProps) {
  return (
    <Card className="border-black/15 shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight">{module.name}</CardTitle>
        <CardDescription className="text-neutral-600">{module.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {module.features.map((feature) => (
            <Badge
              key={feature}
              variant="secondary"
              className="rounded-full border border-black/10 bg-black/5 text-black"
            >
              {feature}
            </Badge>
          ))}
        </div>
        <Separator className="bg-black/10" />
        <Button variant="outline" className="border-black/20" disabled>
          Open module
        </Button>
      </CardContent>
    </Card>
  );
}
