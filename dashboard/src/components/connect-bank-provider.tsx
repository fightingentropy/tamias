"use client";

import { useMutation } from "@tanstack/react-query";
import type { MutableRefObject } from "react";
import { useTRPC } from "@/trpc/client";
import { BankConnectButton } from "./bank-connect-button";

type Props = {
  id: string;
  provider: string;
  availableHistory: number;
  redirectPath?: string;
  countryCode?: string;
  connectRef?: MutableRefObject<(() => void) | null>;
};

export function ConnectBankProvider({
  id,
  provider,
  connectRef,
}: Props) {
  const trpc = useTRPC();
  const updateUsageMutation = useMutation(trpc.institutions.updateUsage.mutationOptions());

  const truelayerAuthMutation = useMutation(
    trpc.banking.truelayerAuthUrl.mutationOptions({
      onSuccess: (result) => {
        if (result?.url) {
          window.location.assign(result.url);
        }
      },
    }),
  );

  const updateUsage = () => {
    updateUsageMutation.mutate({ id });
  };

  switch (provider) {
    case "truelayer":
      return (
        <BankConnectButton
          connectRef={connectRef}
          onClick={() => {
            updateUsage();
            truelayerAuthMutation.mutate({ institutionId: id });
          }}
        />
      );
    default:
      return null;
  }
}
