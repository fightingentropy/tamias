"use client";

import { useEffect, useState } from "react";

export function useDeferredSheetMount(isOpen: boolean) {
  const [shouldMount, setShouldMount] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setShouldMount(true);
    }
  }, [isOpen]);

  return shouldMount;
}
