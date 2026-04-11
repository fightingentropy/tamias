import { isRedirect, redirect } from "@tanstack/react-router";
import {
  isQueryTransportError,
  isUnauthorizedQueryError,
  startContextAuth,
} from "@/start/server/route-data/shared";
import { getQueryClient, trpc } from "@/trpc/server";
import { getPostAuthRedirectPath } from "@/utils/auth-routing";

export async function resolveIndexRoute() {
  const auth = startContextAuth();

  if (!auth.token) {
    return { authenticated: false as const };
  }

  try {
    const queryClient = getQueryClient();
    const user = await queryClient.fetchQuery(trpc.user.me.queryOptions());

    throw redirect({
      to: getPostAuthRedirectPath(user),
      throw: true,
    });
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }

    if (isUnauthorizedQueryError(error) || isQueryTransportError(error)) {
      return { authenticated: false as const };
    }

    throw error;
  }
}
