"use client";

import {
  useChatMessages as useStoredChatMessages,
  useChatStatus as useStoredChatStatus,
} from "@ai-sdk-tools/store";
import { cn } from "@tamias/ui/cn";
import { Conversation, ConversationContent } from "@tamias/ui/conversation";
import dynamic from "@/framework/dynamic";
import { parseAsString, useQueryState } from "nuqs";
import { Portal } from "@/components/portal";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { useChatStatus } from "@/hooks/use-chat-status";
import { useOverviewTab } from "@/hooks/use-overview-tab";
import { ChatHeader, ChatInput, ChatMessages, ChatStatusIndicators } from "./";
import { SuggestedPrompts } from "./suggested-prompts";

// Dynamically load Canvas (15 chart components) - only loads when user opens an artifact
const Canvas = dynamic(
  () => import("@/components/canvas").then((mod) => mod.Canvas),
  { ssr: false },
);

export function ChatInterface() {
  const { isHome } = useChatInterface();
  const messages = useStoredChatMessages();
  const status = useStoredChatStatus();

  const {
    agentStatus,
    currentToolCall,
    artifactStage,
    artifactType,
    currentSection,
    bankAccountRequired,
    hasTextContent,
    hasInsightData,
  } = useChatStatus(messages, status);

  const [selectedType] = useQueryState("artifact-type", parseAsString);
  const { isMetricsTab } = useOverviewTab();

  const hasMessages = messages.length > 0;

  const showCanvas = Boolean(selectedType);

  return (
    <div
      className={cn(
        "relative flex size-full",
        isHome && "h-[calc(100vh-764px)] chat-interface-container-scrollable",
        !isHome && "h-[calc(100vh-88px)] overflow-hidden",
        isMetricsTab && "h-auto",
      )}
    >
      {/* Canvas slides in from right when artifacts are present */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-20",
          showCanvas ? "translate-x-0" : "translate-x-full",
          hasMessages && "transition-transform duration-300 ease-in-out",
          "md:z-20 z-40",
        )}
      >
        <Canvas />
      </div>

      {/* Main chat area - container that slides left when canvas opens */}
      <div
        className={cn(
          "relative flex-1",
          hasMessages && "transition-all duration-300 ease-in-out",
          showCanvas && "mr-0 md:mr-[600px]",
          !hasMessages && "flex items-center justify-center",
        )}
      >
        {hasMessages && (
          <>
            {/* Conversation view - messages with absolute positioning for proper height */}
            <div className="absolute inset-0 flex flex-col">
              <div
                className={cn(
                  "sticky top-0 left-0 z-10 shrink-0",
                  hasMessages && "transition-all duration-300 ease-in-out",
                  showCanvas ? "right-0 md:right-[600px]" : "right-0",
                )}
              >
                <div className="bg-background/80 dark:bg-background/50 backdrop-blur-sm pt-6">
                  <ChatHeader />
                </div>
              </div>
              <Conversation>
                <ConversationContent className="pb-[150px] pt-14">
                  <div className="max-w-2xl mx-auto w-full">
                    <ChatMessages
                      messages={messages}
                      isStreaming={
                        status === "streaming" || status === "submitted"
                      }
                    />
                    <ChatStatusIndicators
                      agentStatus={agentStatus}
                      currentToolCall={currentToolCall}
                      status={status}
                      artifactStage={artifactStage}
                      artifactType={artifactType}
                      currentSection={currentSection}
                      bankAccountRequired={bankAccountRequired}
                      hasTextContent={hasTextContent}
                      hasInsightData={hasInsightData}
                    />
                  </div>
                </ConversationContent>

                <Portal>
                  <div
                    className={cn(
                      "fixed bottom-32 z-0 transition-all duration-300 ease-in-out",
                      "left-0 md:left-[70px] px-4 md:px-6",
                      showCanvas ? "right-0 md:right-[603px]" : "right-0",
                    )}
                  >
                    <div className="mx-auto w-full max-w-full md:max-w-[770px]">
                      <SuggestedPrompts />
                    </div>
                  </div>
                </Portal>
              </Conversation>
            </div>
          </>
        )}

        {isHome ? (
          <div
            className={cn(
              "fixed bottom-0 left-0",
              hasMessages && "transition-all duration-300 ease-in-out",
              showCanvas ? "right-0 md:right-[600px]" : "right-0",
              "chat-input-wrapper-static",
            )}
          >
            <ChatInput />
          </div>
        ) : (
          <Portal>
            <div
              className={cn(
                "fixed bottom-0 left-0",
                hasMessages && "transition-all duration-300 ease-in-out",
                showCanvas ? "right-0 md:right-[600px]" : "right-0",
              )}
            >
              <ChatInput />
            </div>
          </Portal>
        )}
      </div>
    </div>
  );
}
