"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  exact?: boolean;
  badge?: number;
  group: "public" | "member" | "manage";
};

export function ProjectTabs({
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
  const pathname = usePathname();
  const isMember = !!memberRole;
  const isManager = memberRole === "owner" || memberRole === "maintainer";

  const tabs: Tab[] = [
    { href: `/p/${slug}`, label: "Overview", exact: true, group: "public" },
    { href: `/p/${slug}/roles`, label: "Roles", group: "public" },
    { href: `/p/${slug}/team`, label: "Team", group: "public" },
    { href: `/p/${slug}/announcements`, label: "Announcements", group: "public" },
    ...(isMember
      ? ([
          { href: `/p/${slug}/tasks`, label: "Tasks", group: "member" },
          { href: `/p/${slug}/calendar`, label: "Calendar", group: "member" },
          { href: `/p/${slug}/discussion`, label: "Discussion", group: "member" },
          ...(chatEnabled
            ? [{ href: `/p/${slug}/chat`, label: "Chat", group: "member" as const }]
            : []),
        ] as Tab[])
      : []),
    ...(isManager
      ? ([
          { href: `/p/${slug}/applications`, label: "Applications", badge: pendingCount, group: "manage" },
          { href: `/p/${slug}/activity`, label: "Activity", group: "manage" },
        ] as Tab[])
      : []),
  ];

  return (
    <nav className="flex items-stretch gap-0.5 overflow-x-auto border-b border-paper-edge">
      {tabs.map((tab, i) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        const prev = tabs[i - 1];
        const newGroup = prev && prev.group !== tab.group;
        return (
          <div key={tab.href} className="flex items-stretch">
            {newGroup && <span className="my-2 mr-0.5 w-px self-stretch bg-paper-edge" aria-hidden="true" />}
            <Link
              href={tab.href}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 font-mono text-[0.82rem] transition-colors -mb-px ${
                active
                  ? "border-pin-red font-medium text-ink"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-pin-red px-1 py-0.5 font-mono text-[0.62rem] text-white">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
