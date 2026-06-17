"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { loadMoreActivity } from "@/app/activity/actions";
import type { FeedItem, FeedItemType } from "@/lib/activity";

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(ms: number): string {
  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const d = new Date(ms);
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

// Push-pin colour + corner label per activity type.
const TYPE: Record<FeedItemType, { pin: string; label: string; accent: string }> = {
  announcement: { pin: "bg-pin-red", label: "announcement", accent: "text-pin-red" },
  event: { pin: "bg-pin-gold", label: "event", accent: "text-pin-gold" },
  thread: { pin: "bg-pin-teal", label: "discussion", accent: "text-pin-teal" },
  reply: { pin: "bg-pin-teal", label: "reply", accent: "text-pin-teal" },
  task: { pin: "bg-ink", label: "task", accent: "text-ink-soft" },
};

function FeedNote({ item }: { item: FeedItem }) {
  const t = TYPE[item.type];
  const name = item.actor?.displayName ?? item.actor?.githubLogin ?? "Someone";
  return (
    <li className="relative">
      {/* push-pin */}
      <span
        className={`pushpin absolute -top-2 left-6 z-10 h-3.5 w-3.5 rounded-full ${t.pin}`}
        aria-hidden="true"
      />
      <div className="rounded-sm border border-paper-edge bg-paper px-5 pb-4 pt-4 shadow-[0_2px_8px_rgba(0,0,0,.08)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(0,0,0,.14)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-shrink-0">
            {item.actor?.avatarUrl ? (
              <Image
                src={item.actor.avatarUrl}
                alt={name}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pin-teal text-xs font-bold text-white">
                {name[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-ink">
                <span className="font-medium">{name}</span>{" "}
                <span className="text-ink-soft">{item.verb}</span>{" "}
                <Link href={`/p/${item.projectSlug}`} className="font-medium hover:underline">
                  {item.projectTitle}
                </Link>
              </p>
              <span className={`flex-shrink-0 font-mono text-[0.58rem] uppercase tracking-widest ${t.accent}`}>
                {t.label}
              </span>
            </div>
            <Link
              href={item.href}
              className="mt-1 block font-display font-semibold leading-snug text-ink hover:text-pin-teal"
            >
              {item.title}
            </Link>
            {item.detail && (
              <p className="mt-1 truncate font-mono text-xs text-ink-soft">{item.detail}</p>
            )}
            <p className="mt-1.5 font-mono text-[0.65rem] text-ink-soft/70">
              {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ActivityFeed({
  initialItems,
  initialCursor,
}: {
  initialItems: FeedItem[];
  initialCursor: number | null;
}) {
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (cursor == null || pending) return;
    startTransition(async () => {
      const page = await loadMoreActivity(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const fresh = page.items.filter((i) => !seen.has(i.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      setCursor(page.nextCursor);
    });
  }

  return (
    <>
      <ul className="space-y-5">
        {items.map((item, i) => {
          const prev = items[i - 1];
          const newDay = !prev || startOfDay(prev.at) !== startOfDay(item.at);
          return (
            <Fragment key={item.id}>
              {newDay && (
                <li className="flex items-center gap-3 pt-3 first:pt-0">
                  <span className="h-px flex-1 bg-paper-edge" />
                  <span className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft">
                    {dayLabel(item.at)}
                  </span>
                  <span className="h-px flex-1 bg-paper-edge" />
                </li>
              )}
              <FeedNote item={item} />
            </Fragment>
          );
        })}
      </ul>

      {cursor != null && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            disabled={pending}
            className="rounded-md border border-paper-edge bg-paper px-4 py-2 font-mono text-xs text-ink-soft shadow-[0_2px_6px_rgba(0,0,0,.08)] transition-colors hover:text-ink disabled:opacity-50"
          >
            {pending ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
