import { createAppFileRoute } from "@/start/route-hosts";
import { redirect, createFileRoute } from "@tanstack/react-router";

export const Route = createAppFileRoute("/mfa/verify")({
  loader: () => {
    throw redirect({
      to: "/account/security",
      throw: true,
    });
  },
});
