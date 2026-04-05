import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";

export const Route = createAppPublicFileRoute("/login")({
  head: () => ({
    meta: [
      {
        title: "Login | Tamias",
      },
    ],
  }),
});
