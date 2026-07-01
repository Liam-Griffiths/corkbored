import { prisma } from "./db";
import type { UserTier } from "./generated/prisma/client";

export type TierLimits = {
  projects: number;
  profileLinks: number;
  openRolesPerProject: number;
  announcementsPerDay: number;
  invitesPerDay: number;
};

export type LimitKey = keyof TierLimits;

// Central source of truth for per-tier usage limits. Add a key here and every
// enforcement point picks it up — see callers of `limitsFor`/`tierForUser`.
export const LIMITS: Record<UserTier, TierLimits> = {
  free: {
    projects: 3,
    profileLinks: 5,
    openRolesPerProject: 5,
    announcementsPerDay: 3,
    invitesPerDay: 20,
  },
  supporter: {
    projects: 25,
    profileLinks: 25,
    openRolesPerProject: 15,
    announcementsPerDay: 10,
    invitesPerDay: 100,
  },
};

export function limitsFor(tier: UserTier): TierLimits {
  return LIMITS[tier];
}

// Fetch a user's tier, defaulting to `free` when the user is missing.
export async function tierForUser(userId: string): Promise<UserTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });
  return user?.tier ?? "free";
}
