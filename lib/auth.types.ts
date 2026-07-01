import "next-auth";
import type { UserTier } from "./generated/prisma/client";

declare module "next-auth" {
  interface User {
    githubId?: number;
    githubLogin?: string;
    displayName?: string;
    avatarUrl?: string;
    isAdmin?: boolean;
    tier?: UserTier;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubLogin?: string;
      isAdmin?: boolean;
      tier?: UserTier;
    };
  }
}
