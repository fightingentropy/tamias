import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { sanitizeRedirectPath } from "@tamias/utils/sanitize-redirect";
import { getUrl } from "@/utils/environment";

export const Route = createAppPublicFileRoute("/api/auth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const requestUrl = new URL(request.url);
        const origin = getUrl();
        const returnTo = requestUrl.searchParams.get("return_to");

        if (returnTo) {
          const normalized = returnTo.startsWith("/")
            ? returnTo
            : `/${returnTo}`;
          const safePath = sanitizeRedirectPath(normalized);
          return Response.redirect(
            `${origin}/login?return_to=${encodeURIComponent(safePath.slice(1))}`,
            307,
          );
        }

        return Response.redirect(`${origin}/login`, 307);
      },
    },
  },
});
