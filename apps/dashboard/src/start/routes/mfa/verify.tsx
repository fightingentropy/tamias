import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mfa/verify")({
  loader: () => {
    throw redirect({
      to: "/account/security",
      throw: true,
    });
  },
});
