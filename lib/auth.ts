import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
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
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
