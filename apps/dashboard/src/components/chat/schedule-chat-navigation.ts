export function scheduleChatNavigation(
  setChatId: (chatId: string) => void,
  chatId: string,
) {
  if (typeof window === "undefined") {
    setChatId(chatId);
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      setChatId(chatId);
    });
  });
}
