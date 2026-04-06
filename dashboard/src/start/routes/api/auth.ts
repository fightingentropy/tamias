import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { proxyAuthActionRequest } from "@/start/auth/server";

export const Route = createAppPublicFileRoute("/api/auth")({
  server: {
    handlers: {
      POST: ({ request }) => proxyAuthActionRequest(request),
    },
  },
});
