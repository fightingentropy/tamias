import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ensureAppUserForAuthUser } from "./lib/identity";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId }) {
      await ensureAppUserForAuthUser(ctx, userId);
    },
  },
  jwt: {
    async customClaims(ctx, { userId }) {
      const user = await ctx.db.get(userId);

      return {
        email: user?.email,
        name: user?.name,
      };
    },
  },
});
