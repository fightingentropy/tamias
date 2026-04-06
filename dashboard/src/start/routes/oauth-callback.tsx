import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { isOAuthErrorCode } from "@tamias/app-store/oauth-errors";
import { createServerFn } from "@tanstack/react-start";
import { oauthCallbackSearchParamsSchema } from "@/components/oauth/oauth-callback-schema";

export const loadOAuthCallbackData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const requestUrl = new URL(data.href, "http://localhost");
    const parsedSearchParams = oauthCallbackSearchParamsSchema.safeParse(
      Object.fromEntries(requestUrl.searchParams.entries()),
    );

    if (!parsedSearchParams.success) {
      return {
        status: "not-found" as const,
      };
    }

    return parsedSearchParams.data;
  });

export const Route = createAppPublicFileRoute("/oauth-callback")({
  loader: ({ location }) =>
    loadOAuthCallbackData({
      data: {
        href: location.href,
      },
    }),
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
});
