import { usePathname, useRouter } from "@/framework/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef } from "react";

// Helper to extract chat ID from pathname with /chat/ prefix
function extractChatId(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const chatIndex = segments.indexOf("chat");

  // If "chat" segment exists and there's an ID after it
  if (chatIndex !== -1) {
    const id = segments[chatIndex + 1];
    if (id) {
      return id;
    }
  }

  return null;
}

export function useChatInterface() {
  const pathname = usePathname();
  const router = useRouter();
  const [, setSelectedType] = useQueryState("artifact-type", parseAsString);
  const chatId = extractChatId(pathname);
  const navigationTimeoutRef = useRef<number | null>(null);

  // Clear artifact-type and reset title when navigating away from chat pages
  const handleNavigateAway = () => {
    setSelectedType(null);
    document.title = "Dashboard | Tamias";
  };

  useEffect(() => {
    if (!chatId) {
      handleNavigateAway();
    }
  }, [chatId, setSelectedType]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current !== null) {
        window.clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const isHome = !chatId;
  const isChatPage = Boolean(chatId);

  const setChatId = (id: string) => {
    if (chatId === id) {
      return;
    }

    // Preserve query parameters when updating the URL
    const currentSearch = window.location.search;
    const segments = pathname.split("/").filter(Boolean);

    // Check if first segment is a locale (2 chars like 'en', 'sv', etc.)
    const hasLocale = segments[0]?.length === 2;
    const locale = hasLocale ? segments[0] : null;

    const newPath = locale
      ? `/${locale}/chat/${id}${currentSearch}`
      : `/chat/${id}${currentSearch}`;

    if (navigationTimeoutRef.current !== null) {
      window.clearTimeout(navigationTimeoutRef.current);
    }

    navigationTimeoutRef.current = window.setTimeout(() => {
      void router.push(newPath);
    }, 75);
  };

  return {
    isHome,
    isChatPage,
    chatId,
    setChatId,
  };
}
