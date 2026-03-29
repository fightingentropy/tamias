import { sanitizeRedirectPath } from "@tamias/utils/sanitize-redirect";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUrl } from "@/utils/environment";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const origin = getUrl();
  const returnTo = requestUrl.searchParams.get("return_to");

  if (returnTo) {
    const normalized = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
    const safePath = sanitizeRedirectPath(normalized);
    return NextResponse.redirect(`${origin}/login?return_to=${encodeURIComponent(safePath.slice(1))}`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
