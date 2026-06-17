import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ActivityFeed } from "@/components/ActivityFeed";
import { getActivityFeed } from "@/lib/activity";

const ACTIVITY_FEED_ENABLED = process.env.ACTIVITY_FEED_ENABLED === "true";

export default async function YourBoardPage() {
  if (!ACTIVITY_FEED_ENABLED) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/activity");

  const { items, nextCursor } = await getActivityFeed(session.user.id);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-ink">Your board</h1>
          <p className="font-mono text-xs text-ink-soft mt-0.5">
            Pinned from the projects &amp; people you follow.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-paper-edge p-10 text-center">
            <p className="font-mono text-sm text-ink-soft">Your board is quiet.</p>
            <p className="mt-1 font-mono text-xs text-ink-soft">
              Follow projects and people from{" "}
              <Link href="/board" className="text-pin-teal hover:underline">
                the board
              </Link>{" "}
              to see their activity here.
            </p>
          </div>
        ) : (
          <ActivityFeed initialItems={items} initialCursor={nextCursor} />
        )}
      </main>
    </>
  );
}
