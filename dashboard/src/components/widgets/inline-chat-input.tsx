"use client";

import { Icons } from "@tamias/ui/icons";
import { useCallback, useState } from "react";

const loadChatInterface = () =>
  import("../chat/chat-interface").then((mod) => ({
    default: mod.ChatInterface,
  }));

interface InlineChatInputProps {
  onOpen: () => void;
}

export function InlineChatInput({ onOpen }: InlineChatInputProps) {
  const [prefetched, setPrefetched] = useState(false);

  const prefetch = useCallback(() => {
    if (!prefetched) {
      void loadChatInterface();
      setPrefetched(true);
    }
  }, [prefetched]);

  return (
    <div className="mb-6 w-full max-w-[580px] mx-auto">
      <button
        type="button"
        className="w-full flex items-center border border-[#e6e6e6] dark:border-[#1d1d1d] hover:border-[#d0d0d0] dark:hover:border-[#222222] bg-white dark:bg-[#0c0c0c] hover:bg-[#f7f7f7] dark:hover:bg-[#0f0f0f] transition-all duration-300 cursor-text text-left"
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onClick={onOpen}
      >
        <div className="flex-1 flex items-center gap-3 px-4 py-3.5">
          <Icons.AI className="size-4 text-[#878787] flex-shrink-0" />
          <span className="text-sm text-[#878787]">How can I help you today?</span>
        </div>
        <div className="pr-2">
          <div className="size-8 flex items-center justify-center bg-[#1d1d1d] dark:bg-[#e6e6e6]">
            <Icons.ArrowUpward className="size-4 text-white dark:text-black" />
          </div>
        </div>
      </button>
    </div>
  );
}
