export function getLogoURL(id: string, ext?: string) {
  return `https://cdn-engine.tamias.xyz/${id}.${ext || "jpg"}`;
}

/** Host for mirrored institution assets (R2); must resolve in the deployment environment */
export const INSTITUTION_LOGO_CDN_HOST = "cdn-engine.tamias.xyz";

/**
 * Plaid returns institution logos as base64 PNG when optional metadata is enabled.
 * Prefer that for search/list UIs so logos work without the Tamias CDN mirror.
 */
export function plaidEmbeddedInstitutionLogo(base64Png: string | null | undefined): string | null {
  if (base64Png != null && base64Png !== "") {
    return `data:image/png;base64,${base64Png}`;
  }
  return null;
}

export function getFileExtension(url: string) {
  return url.split(".").at(-1);
}
