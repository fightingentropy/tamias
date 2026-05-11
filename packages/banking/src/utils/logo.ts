export function getLogoURL(id: string, ext?: string) {
  return `https://cdn-engine.tamias.xyz/${id}.${ext || "jpg"}`;
}

/** Host for mirrored institution assets (R2); must resolve in the deployment environment */
export const INSTITUTION_LOGO_CDN_HOST = "cdn-engine.tamias.xyz";

export function getFileExtension(url: string) {
  return url.split(".").at(-1);
}
