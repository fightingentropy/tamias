import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { getConvexAuthToken } from "@/start/auth/server";
import { getTRPCClient } from "@/trpc/server";
import { getUrl } from "@/utils/environment";

export const Route = createAppPublicFileRoute("/api/gocardless/reconnect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getUrl();
        const token = await getConvexAuthToken();

        if (!token) {
          return Response.redirect(new URL("/", origin), 307);
        }

        const requestUrl = new URL(request.url);
        const id = requestUrl.searchParams.get("id");
        const referenceId =
          requestUrl.searchParams.get("reference_id") ?? undefined;
        const accessValidForDays = Number(
          requestUrl.searchParams.get("access_valid_for_days"),
        );

        if (id) {
          const trpc = await getTRPCClient();

          await trpc.bankConnections.updateReconnectById.mutate({
            id,
            referenceId,
            accessValidForDays: accessValidForDays || 180,
          });
        }

        return Response.redirect(
          `${origin}/settings/accounts?id=${id}&step=reconnect`,
          307,
        );
      },
    },
  },
});
