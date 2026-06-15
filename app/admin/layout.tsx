import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/boost", label: "Boost" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/api/auth/signin?callbackUrl=/admin");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.isAdmin) redirect("/");

  return (
    <>
      <Header />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-44 flex-shrink-0">
            <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">Admin</p>
            <ul className="space-y-0.5">
              {NAV.map((item) => (
                <li key={item.href}>
                  <AdminNavLink href={item.href} exact={item.exact}>
                    {item.label}
                  </AdminNavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </>
  );
}

function AdminNavLink({
  href,
  children,
  exact,
}: {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-1.5 font-mono text-sm text-ink-soft hover:bg-paper-edge hover:text-ink transition-colors"
    >
      {children}
    </Link>
  );
}
