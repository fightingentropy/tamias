"use client";

import type { RouterOutputs } from "@tamias/trpc";
import { createContext, useContext, type ReactNode } from "react";

export type SelectedInboxItem = NonNullable<
  RouterOutputs["inbox"]["getById"]
>;

const SelectedInboxItemContext = createContext<SelectedInboxItem | undefined>(
  undefined,
);

type SelectedInboxItemProviderProps = {
  children: ReactNode;
  value: SelectedInboxItem;
};

export function SelectedInboxItemProvider({
  children,
  value,
}: SelectedInboxItemProviderProps) {
  return (
    <SelectedInboxItemContext.Provider value={value}>
      {children}
    </SelectedInboxItemContext.Provider>
  );
}

export function useSelectedInboxItem() {
  const context = useContext(SelectedInboxItemContext);

  if (context === undefined) {
    throw new Error(
      "useSelectedInboxItem must be used within a SelectedInboxItemProvider",
    );
  }

  return context;
}
