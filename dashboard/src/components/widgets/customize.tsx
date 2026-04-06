"use client";

import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { usePathname } from "@/framework/navigation";
import { useIsCustomizing, useWidgetActions } from "./widget-provider";

export function Customize() {
  const pathname = usePathname();
  const isCustomizing = useIsCustomizing();
  const { setIsCustomizing } = useWidgetActions();

  const isOnDashboardPath = pathname === "/dashboard";

  if (!isOnDashboardPath) {
    return null;
  }

  return (
    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsCustomizing(!isCustomizing)}>
      {isCustomizing ? <Icons.Check size={16} /> : <Icons.DashboardCustomize size={16} />}
    </Button>
  );
}
