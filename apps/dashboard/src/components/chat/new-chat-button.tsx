"use client";

import { useChatActions } from "@ai-sdk-tools/store";
import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { useRouter } from "@/framework/navigation";

export function NewChatButton() {
  const router = useRouter();
  const { reset } = useChatActions();

  const handleNewChat = () => {
    reset();
    router.push("/dashboard");
  };

  return (
    <Button
      type="button"
      onClick={handleNewChat}
      variant="outline"
      size="icon"
      title="New chat"
    >
      <Icons.Add size={16} />
    </Button>
  );
}
