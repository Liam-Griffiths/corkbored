import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { env } from "./env";
import { CONSENT_COOKIE } from "./legal";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: env.AUTH_SECRET,
  pages: { signIn: "/signin" },
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      profile(profile) {
        const adminLogins = (process.env.ADMIN_GITHUB_LOGINS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          id: String(profile.id),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubId: profile.id,
          githubLogin: profile.login,
          displayName: profile.name ?? profile.login,
          avatarUrl: profile.avatar_url,
          isAdmin: adminLogins.includes(profile.login),
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      // PrismaAdapter passes the full DB user, so tier is present. Surfaced for
      // UI only — all limit enforcement reads tier from the DB directly.
      session.user.tier = (user as typeof user & { tier?: "free" | "supporter" }).tier;

      // Bridge the consent captured on the sign-in screen onto the user record
      // the first time we see them authenticated. The cookie is set just before
      // the GitHub OAuth redirect and survives the round trip.
      const u = user as typeof user & { termsAcceptedAt?: Date | null };
      if (!u.termsAcceptedAt) {
        try {
          const version = (await cookies()).get(CONSENT_COOKIE)?.value;
          if (version) {
            await prisma.user.update({
              where: { id: user.id },
              data: { termsAcceptedAt: new Date(), termsVersion: version },
            });
          }
        } catch {
          // cookies() not available in this context — skip; recorded next session.
        }
      }

      return session;
    },
  },
});
