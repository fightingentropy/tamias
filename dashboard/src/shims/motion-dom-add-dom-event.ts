/**
 * Workerd and some SSR DOM implementations require `passive: false` for `resize` listeners.
 * motion-dom's addDomEvent defaults to `{ passive: true }`, which throws during SSR.
 *
 * @see dashboard/vite.config.mts resolve.alias
 */

export function addDomEvent(
  target: EventTarget,
  eventName: string,
  handler: EventListener,
  options: AddEventListenerOptions = { passive: true },
): () => void {
  const merged =
    eventName === "resize" &&
    options &&
    typeof options === "object" &&
    options.passive === true
      ? { ...options, passive: false }
      : options;

  target.addEventListener(eventName, handler, merged);

  return () => target.removeEventListener(eventName, handler);
}
