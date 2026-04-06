export function normalizeWebsiteHost(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).hostname;
  } catch {
    return null;
  }
}

/**
 * Favicon URL for avatars and small brandmarks. Uses a stable third-party endpoint so
 * demo or placeholder domains do not trigger follow-up 404s on the customer's site.
 */
export function getWebsiteFaviconUrl(
  website?: string | null,
  sizePx = 64,
): string {
  if (!website) return "";
  const host = normalizeWebsiteHost(website);
  if (!host) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${sizePx}`;
}
