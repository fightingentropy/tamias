import { isRedirect, redirect } from "@tanstack/react-router";
import { startContextAuth } from "@/start/server/route-data/shared";
import { getQueryClient, trpc } from "@/trpc/server";
import { getPostAuthRedirectPath } from "@/utils/auth-routing";

export async function resolveLoginRoute() {
  const auth = startContextAuth();

  if (!auth.token) {
    return;
  }

  try {
    const queryClient = getQueryClient();
    const user = await queryClient.fetchQuery(trpc.user.me.queryOptions());

    if (!user) {
      return;
    }

    throw redirect({
      to: getPostAuthRedirectPath(user),
      throw: true,
    });
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }

    // The redirect check is best-effort. A login page must stay renderable even
    // when an existing session points at a broken or unavailable user record.
    return;
  }
}
