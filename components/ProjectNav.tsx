"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  badge?: number;
  icon?: string;
  highlight?: boolean;
};

function Item({ item, slug }: { item: NavItem; slug: string }) {
  const pathname = usePathname();
  const isActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between rounded-md px-3 py-2 font-mono text-sm transition-colors ${
        isActive
          ? "bg-paper-edge text-ink font-medium"
          : item.highlight
            ? "text-pin-teal hover:bg-pin-teal/8 hover:text-pin-teal"
            : "text-ink-soft hover:bg-paper-edge/60 hover:text-ink"
      }`}
    >
      <span className="flex items-center gap-2">
        {item.icon && <span className="text-base leading-none">{item.icon}</span>}
        {item.label}
      </span>
      {item.badge != null && item.badge > 0 && (
        <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-pin-red px-1 py-0.5 font-mono text-[0.6rem] text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

export function ProjectNav({
  slug,
  memberRole,
  pendingCount,
  chatEnabled,
}: {
  slug: string;
  memberRole: string | null;
  pendingCount: number;
  chatEnabled: boolean;
}) {
  const isMember = !!memberRole;
  const isOwnerOrMaintainer = memberRole === "owner" || memberRole === "maintainer";

  const publicItems: NavItem[] = [
    { href: `/p/${slug}`, label: "Overview", exact: true, icon: "◈" },
    { href: `/p/${slug}/announcements`, label: "Announcements", icon: "📢" },
    { href: `/p/${slug}/roles`, label: "Open roles", icon: "🎯" },
    { href: `/p/${slug}/team`, label: "Team", icon: "👥" },
  ];

  const memberItems: NavItem[] = [
    { href: `/p/${slug}/tasks`, label: "Tasks", icon: "✓" },
    { href: `/p/${slug}/discussion`, label: "Discussion", icon: "💬" },
    ...(chatEnabled
      ? [{ href: `/p/${slug}/chat`, label: "Chat", icon: "⚡", highlight: true }]
      : []),
  ];

  const ownerItems: NavItem[] = [
    { href: `/p/${slug}/applications`, label: "Applications", icon: "📥", badge: pendingCount },
    { href: `/p/${slug}/activity`, label: "Activity", icon: "⏱" },
  ];

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {publicItems.map((item) => (
        <Item key={item.href} item={item} slug={slug} />
      ))}

      {isMember && (
        <>
          <div className="my-2 px-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft/60">Members</p>
          </div>
          {memberItems.map((item) => (
            <Item key={item.href} item={item} slug={slug} />
          ))}
        </>
      )}

      {isOwnerOrMaintainer && (
        <>
          <div className="my-2 px-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft/60">Manage</p>
          </div>
          {ownerItems.map((item) => (
            <Item key={item.href} item={item} slug={slug} />
          ))}
        </>
      )}
    </nav>
  );
}
