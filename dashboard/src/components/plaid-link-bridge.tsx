"use client";

import { getPlaidEnvironment } from "@tamias/utils/envs";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkOnExit, PlaidLinkOnSuccess } from "react-plaid-link";

export type PlaidLinkBridgeSession = {
  token: string;
  onSuccess: PlaidLinkOnSuccess;
  onExit?: PlaidLinkOnExit;
};

type PlaidLinkBridgeContextValue = {
  setSession: (session: PlaidLinkBridgeSession | null) => void;
  open: () => void;
  ready: boolean;
};

const PlaidLinkBridgeContext = createContext<PlaidLinkBridgeContextValue | null>(null);

export function usePlaidLinkBridge() {
  const ctx = useContext(PlaidLinkBridgeContext);

  if (!ctx) {
    throw new Error("usePlaidLinkBridge must be used within PlaidLinkBridgeProvider");
  }

  return ctx;
}

/**
 * Single `usePlaidLink` for the dashboard. Plaid only supports one Link embed per page;
 * each extra `usePlaidLink` loads duplicate scripts and breaks open/iframe input handling.
 */
export function PlaidLinkBridgeProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PlaidLinkBridgeSession | null>(null);
  const sessionRef = useRef<PlaidLinkBridgeSession | null>(null);
  sessionRef.current = session;
  const linkSurfaceOpenRef = useRef(false);

  const plaidEnvironment = getPlaidEnvironment();

  const { open: openFromHook, ready } = usePlaidLink({
    token: session?.token,
    publicKey: "",
    env: plaidEnvironment,
    clientName: "Tamias",
    product: ["transactions"],
    onSuccess: async (publicToken, metadata) => {
      try {
        await sessionRef.current?.onSuccess(publicToken, metadata);
      } finally {
        linkSurfaceOpenRef.current = false;
        setSession(null);
      }
    },
    onExit: (error, metadata) => {
      sessionRef.current?.onExit?.(error, metadata);
      linkSurfaceOpenRef.current = false;
      setSession(null);
    },
  });

  const setSessionStable = useCallback((next: PlaidLinkBridgeSession | null) => {
    if (next === null) {
      linkSurfaceOpenRef.current = false;
    }
    setSession(next);
  }, []);

  const openStable = useCallback(() => {
    if (linkSurfaceOpenRef.current) {
      return;
    }
    linkSurfaceOpenRef.current = true;
    openFromHook();
  }, [openFromHook]);

  const value = useMemo(
    () => ({
      setSession: setSessionStable,
      open: openStable,
      ready,
    }),
    [setSessionStable, openStable, ready],
  );

  return <PlaidLinkBridgeContext.Provider value={value}>{children}</PlaidLinkBridgeContext.Provider>;
}
