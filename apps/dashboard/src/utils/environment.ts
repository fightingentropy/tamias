export function getUrl() {
  if (process.env.NEXT_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_URL;
  }

  if (process.env.NEXT_PUBLIC_CLOUDFLARE_URL) {
    return process.env.NEXT_PUBLIC_CLOUDFLARE_URL;
  }

  return "http://localhost:3001";
}
