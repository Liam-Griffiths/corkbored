import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationBell } from "./NotificationBell";

const LIVE_NOTIFICATIONS_ENABLED = process.env.LIVE_NOTIFICATIONS_ENABLED === "true";
const ACTIVITY_FEED_ENABLED = process.env.ACTIVITY_FEED_ENABLED === "true";

export async function Header() {
  const session = await auth();
  const user = session?.user;

  const notifications = user?.id
    ? await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  async function markAllRead() {
    "use server";
    const s = await auth();
    if (!s?.user?.id) return;
    await prisma.notification.updateMany({
      where: { userId: s.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-board/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-bold text-lg text-ink"
        >
          <span
            className="inline-block h-[0.6em] w-[0.6em] rounded-full bg-pin-red shadow-[inset_-2px_-2px_3px_rgba(0,0,0,.35)]"
            aria-hidden="true"
          />
          corkbored
        </Link>

        <nav className="flex flex-1 gap-1">
          <Link
            href="/board"
            className="rounded-md px-3 py-1.5 font-mono text-sm text-ink/70 hover:bg-ink/8 hover:text-ink"
          >
            the board
          </Link>
          {user && (
            <>
              {ACTIVITY_FEED_ENABLED && (
                <Link
                  href="/activity"
                  className="rounded-md px-3 py-1.5 font-mono text-sm text-ink/70 hover:bg-ink/8 hover:text-ink"
                >
                  your board
                </Link>
              )}
              <Link
                href="/me"
                className="rounded-md px-3 py-1.5 font-mono text-sm text-ink/70 hover:bg-ink/8 hover:text-ink"
              >
                profile
              </Link>
              <Link
                href="/projects/new"
                className="rounded-md px-3 py-1.5 font-mono text-sm text-ink/70 hover:bg-ink/8 hover:text-ink"
              >
                pin a project
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <NotificationBell
              notifications={notifications}
              markAllReadAction={markAllRead}
              live={LIVE_NOTIFICATIONS_ENABLED}
            />
          )}
          {user ? (
            <>
              <span className="flex items-center gap-2 font-mono text-sm text-ink-soft">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pin-teal text-xs font-semibold text-white">
                  {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                </span>
                {user.githubLogin ?? user.name}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-md border border-ink/20 px-3 py-1.5 font-mono text-xs text-ink-soft hover:border-ink/40 hover:text-ink"
                >
                  sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/signin"
              className="rounded-md bg-pin-red px-4 py-2 font-mono text-sm font-medium text-white shadow-[0_2px_0_#7c2d14] hover:-translate-y-px active:translate-y-px"
            >
              sign in with GitHub
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
