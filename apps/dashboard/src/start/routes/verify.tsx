import { createAppPublicFileRoute } from "@/start/route-hosts";
import { redirect, createFileRoute } from "@tanstack/react-router";

export const Route = createAppPublicFileRoute("/verify")({
  beforeLoad: () => {
    throw redirect({
      to: "/login",
      throw: true,
    });
  },
});
