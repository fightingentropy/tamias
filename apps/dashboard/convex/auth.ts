import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { normalizeEmail } from "../../../packages/domain/src/identity";
import { ensureAppUserForAuthUser } from "./lib/identity";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile: (params) => {
        const email = normalizeEmail(params.email as string | undefined);
        if (!email) {
          throw new Error("Invalid email");
        }
        return { email };
      },
    }),
  ],
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
