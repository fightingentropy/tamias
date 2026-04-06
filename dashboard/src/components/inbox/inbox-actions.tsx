"use client";

import { AnimatePresence } from "framer-motion";
import { MatchTransaction } from "./match-transaction";
import { SelectedInboxItemProvider, type SelectedInboxItem } from "./selected-inbox-item-context";
import { SuggestedMatch } from "./suggested-match";

type Props = {
  data: SelectedInboxItem;
};

export function InboxActions({ data }: Props) {
  const isOtherDocument = data?.status === "other" || data?.type === "other";

  if (isOtherDocument) {
    return null;
  }

  const hasSuggestion =
    data?.status === "suggested_match" && !data?.transactionId && !!data?.suggestion;

  return (
    <SelectedInboxItemProvider value={data}>
      <AnimatePresence>
        {hasSuggestion && <SuggestedMatch key="suggested-match" />}

        {!hasSuggestion && <MatchTransaction key="match-transaction" />}
      </AnimatePresence>
    </SelectedInboxItemProvider>
  );
}
