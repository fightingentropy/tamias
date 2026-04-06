"use client";

import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { useMetricsCustomize } from "@/hooks/use-metrics-customize";

export function ReportsCustomize() {
  const { isCustomizing, setIsCustomizing } = useMetricsCustomize();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-2"
      onClick={() => setIsCustomizing(!isCustomizing)}
    >
      {isCustomizing ? <Icons.Check size={16} /> : <Icons.DashboardCustomize size={16} />}
      <span>Customize</span>
    </Button>
  );
}
