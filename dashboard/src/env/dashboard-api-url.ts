/**
 * Browser tRPC must resolve the API origin from this package (dashboard `src/`) so Vite
 * `define` reliably inlines `process.env.*`. In unified `vite dev`, the API is served on the
 * same origin as the app (`DASHBOARD_URL`); using `API_URL` (often `https://api.tamias.xyz`)
 * would cross-call production and diverge from SSR (and break local-only credentials/CORS).
 */
export function getDashboardApiUrl(): string {
  if (import.meta.env.DEV) {
    const dash = process.env.DASHBOARD_URL;
    if (dash) {
      try {
        return new URL(dash).origin;
      } catch {
        /* fall through */
      }
    }

    return "http://localhost:3001";
  }

  const apiUrl = process.env.API_URL;
  if (apiUrl) {
    return apiUrl;
  }

  const tamiasApiUrl = process.env.TAMIAS_API_URL;
  if (tamiasApiUrl) {
    return tamiasApiUrl;
  }

  return "https://api.tamias.xyz";
}
