import { getAuthUserId } from "@convex-dev/auth/server";
import { queryGeneric } from "convex/server";

export const viewer = queryGeneric({
  args: {},
  async handler(ctx) {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    return await ctx.db.get(userId);
  },
});
