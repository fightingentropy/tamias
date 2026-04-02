import { createFileRoute } from "@tanstack/react-router";
import { proxyAuthActionRequest } from "@/start/auth/server";

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      POST: ({ request }) => proxyAuthActionRequest(request),
    },
  },
});
