"use client";

import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { Spinner } from "@tamias/ui/spinner";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useChatInterface } from "@/hooks/use-chat-interface";
import type { Geo } from "@/utils/geo";
import { useDashboardChatSession } from "./use-dashboard-chat-session";

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

function HomeChatRuntime({ geo }: { geo?: Geo }) {
  useDashboardChatSession({ geo });
  return null;
}

export function DeferredHomeChat({ geo }: { geo?: Geo }) {
  const { isChatPage } = useChatInterface();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isChatPage) {
      setIsOpen(true);
    }
  }, [isChatPage]);

  if (isOpen || isChatPage) {
    return <DeferredChatInterface geo={geo} />;
  }

  const prefetchChatInterface = () => {
    void loadChatInterface();
  };

  return (
    <>
      <HomeChatRuntime geo={geo} />
      <div className="mt-8 mb-10 flex justify-center">
        <Button
          variant="outline"
          className="h-11 rounded-full px-5 text-sm"
          onMouseEnter={prefetchChatInterface}
          onFocus={prefetchChatInterface}
          onClick={() => setIsOpen(true)}
        >
          <Icons.AI className="mr-2 size-4" />
          Open assistant
        </Button>
      </div>
    </>
  );
}
