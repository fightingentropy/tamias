"use client";

import type { RouterOutputs } from "@tamias/trpc";
import { useI18n } from "@/locales/client";

type Props = {
  method: RouterOutputs["transactions"]["get"]["data"][number]["method"];
};

export function TransactionMethod({ method }: Props) {
  const t = useI18n();

  return t(`transaction_methods.${method}`);
}
