"use client";

import type { AppRouter } from "@tamias/trpc";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { createContext, useContext, type ReactNode } from "react";
import { useTRPC } from "@/trpc/client";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type CurrentUser = NonNullable<RouterOutputs["user"]["me"]>;

export const USER_QUERY_REFETCH_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const USER_QUERY_STALE_TIME_MS = USER_QUERY_REFETCH_INTERVAL_MS;

const CurrentUserContext = createContext<CurrentUser | null>(null);

type CurrentUserProviderProps = {
  initialUser: CurrentUser;
  children: ReactNode;
};

export function CurrentUserProvider({ initialUser, children }: CurrentUserProviderProps) {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.user.me.queryOptions(),
    initialData: initialUser,
    staleTime: USER_QUERY_STALE_TIME_MS,
    refetchInterval: USER_QUERY_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: false,
  });

  return (
    <CurrentUserContext.Provider value={data ?? initialUser}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const user = useContext(CurrentUserContext);

  if (!user) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider");
  }

  return user;
}

export function useOptionalCurrentUser() {
  return useContext(CurrentUserContext);
}
