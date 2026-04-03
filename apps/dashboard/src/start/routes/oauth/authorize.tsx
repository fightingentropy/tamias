import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadOAuthAuthorizeData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildOAuthAuthorizePageData } = await import(
      "@/start/server/route-data/public"
    );

    return (await buildOAuthAuthorizePageData(data.href)) as any;
  });

export const Route = createAppFileRoute("/oauth/authorize")({
  loader: ({ location }) =>
    loadOAuthAuthorizeData({
      data: {
        href: location.href,
      },
    }),
  head: () => ({
    meta: [{ title: "Authorize API Access | Tamias" }],
  }),
});
