import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mfa/setup")({
  loader: () => {
    throw redirect({
      to: "/account/security",
      throw: true,
    });
  },
});
