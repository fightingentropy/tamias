import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { proxyPasswordResetRequest } from "@/start/auth/server";

export const Route = createAppPublicFileRoute("/api/password-reset")({
  server: {
    handlers: {
      POST: ({ request }) => proxyPasswordResetRequest(request),
    },
  },
});
