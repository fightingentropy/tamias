import { redirect } from "@tanstack/react-router";
import {
  isUnauthorizedQueryError,
  startContextAuth,
} from "@/start/server/route-data/shared";
import { getQueryClient, trpc } from "@/trpc/server";
import { getPostAuthRedirectPath } from "@/utils/auth-routing";

export async function resolveIndexRoute() {
  const auth = startContextAuth();

  if (!auth.token) {
    throw redirect({
      to: "/login",
      throw: true,
    });
  }

  try {
    const queryClient = getQueryClient();
    const user = await queryClient.fetchQuery(trpc.user.me.queryOptions());

    throw redirect({
      to: getPostAuthRedirectPath(user),
      throw: true,
    });
  } catch (error) {
    if (isUnauthorizedQueryError(error)) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw error;
  }
}
