"use client";

import { Spinner } from "@tamias/ui/spinner";
import dynamic from "@/framework/dynamic";
import { useEffect, useState } from "react";
import { useChatInterface } from "@/hooks/use-chat-interface";

const loadChatInterface = () =>
  import("./chat-interface").then((mod) => ({
    default: mod.ChatInterface,
  }));

const DeferredChatInterface = dynamic(loadChatInterface, {
  ssr: false,
  loading: () => (
    <div className="mt-8 flex min-h-[180px] items-center justify-center border border-[#e6e6e6] bg-background dark:border-[#1d1d1d]">
      <Spinner size={18} />
    </div>
  ),
});

interface DeferredHomeChatProps {
  forceOpen?: boolean;
}

export function DeferredHomeChat({ forceOpen }: DeferredHomeChatProps) {
  const { isChatPage } = useChatInterface();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isChatPage || forceOpen) {
      setIsOpen(true);
    }
  }, [isChatPage, forceOpen]);

  if (isOpen || isChatPage) {
    return <DeferredChatInterface />;
  }

  return null;
}
