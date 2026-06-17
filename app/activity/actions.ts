"use server";

import { auth } from "@/lib/auth";
import { getActivityFeed, type FeedPage } from "@/lib/activity";

const ACTIVITY_FEED_ENABLED = process.env.ACTIVITY_FEED_ENABLED === "true";

const EMPTY: FeedPage = { items: [], nextCursor: null };

/**
 * Fetch the next page of the signed-in user's activity feed, older than
 * `cursor` (epoch ms). The user is resolved from the session — never trusted
 * from the client.
 */
export async function loadMoreActivity(cursor: number): Promise<FeedPage> {
  if (!ACTIVITY_FEED_ENABLED) return EMPTY;
  const session = await auth();
  if (!session?.user?.id) return EMPTY;
  if (!Number.isFinite(cursor)) return EMPTY;
  return getActivityFeed(session.user.id, cursor);
}
