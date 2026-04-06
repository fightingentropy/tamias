"use client";

import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { useTrackerParams } from "@/hooks/use-tracker-params";

export function OpenTrackerSheet() {
  const { setParams } = useTrackerParams();

  return (
    <div>
      <Button variant="outline" size="icon" onClick={() => setParams({ create: true })}>
        <Icons.Add />
      </Button>
    </div>
  );
}
