"use client";

import { getInboxEmail } from "@tamias/inbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@tamias/ui/accordion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/framework/navigation";
import { useEffect, useRef } from "react";
import { AppConnectionToast } from "@/components/app-connection-toast";
import { ConnectGmail } from "@/components/inbox/connect-gmail";
import { ConnectOutlook } from "@/components/inbox/connect-outlook";
import { ConnectSlack } from "@/components/inbox/connect-slack";
import { ConnectWhatsApp } from "@/components/inbox/connect-whatsapp";
import { useInboxParams } from "@/hooks/use-inbox-params";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { CopyInput } from "../copy-input";
import { UploadZone } from "./inbox-upload-zone";

export function InboxGetStarted() {
  const { data: user } = useUserQuery();
  const { setParams } = useInboxParams();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const hasDetectedInboxRef = useRef(false);

  const handleUpload = async (inboxId?: string) => {
    // Invalidate client-side queries
    await queryClient.invalidateQueries({
      queryKey: trpc.inbox.get.infiniteQueryKey(),
    });

    await router.refresh();

    // Navigate to inbox
    if (inboxId) {
      setParams({ inboxId });
    }
  };

  const { data: inboxData } = useQuery({
    ...trpc.inbox.get.queryOptions({
      pageSize: 1,
      tab: "all",
    }),
    enabled: Boolean(user?.teamId),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  useEffect(() => {
    const firstInboxItem = inboxData?.data.at(0);

    if (!firstInboxItem?.id || hasDetectedInboxRef.current) {
      return;
    }

    hasDetectedInboxRef.current = true;

    void (async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.inbox.get.infiniteQueryKey(),
      });

      router.refresh();
      setParams({ inboxId: firstInboxItem.id });
    })();
  }, [inboxData, queryClient, router, setParams, trpc.inbox.get]);

  return (
    <UploadZone onUploadComplete={handleUpload}>
      <AppConnectionToast />
      <div className="h-[calc(100vh-150px)] flex items-center justify-center">
        <div className="relative z-20 m-auto flex w-full max-w-[380px] flex-col">
          <div className="flex w-full flex-col relative">
            <div className="pb-4 text-center">
              <h2 className="font-medium text-lg">Connect Your Inbox</h2>
              <p className="pb-6 text-sm text-[#878787]">
                Connect your email or messaging apps to automatically import receipts and invoices.
                We'll extract the data and match it to your transactions.
              </p>
            </div>

            <div className="pointer-events-auto flex flex-col space-y-4">
              <ConnectGmail />
              <ConnectOutlook />

              <Accordion type="single" collapsible className="border-t-[1px] pt-2 mt-6">
                <AccordionItem value="item-1" className="border-0">
                  <AccordionTrigger className="justify-center space-x-2 flex text-sm">
                    <span>More options</span>
                  </AccordionTrigger>
                  <AccordionContent className="mt-4">
                    <div className="flex flex-col space-y-4">
                      <ConnectSlack />
                      <ConnectWhatsApp />
                      {user?.team?.inboxId && (
                        <CopyInput value={getInboxEmail(user.team.inboxId)} />
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div className="text-center mt-8">
              <p className="text-xs text-[#878787]">
                You can also just drag and drop files here for automatic reconciliation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </UploadZone>
  );
}
