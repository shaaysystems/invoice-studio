import Link from "next/link";
import { FileText, LayoutDashboard, Palette, Plus, Settings, User } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices/new", label: "New invoice", icon: Plus },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/business", label: "Business profile", icon: User },
  { href: "/dashboard/brand", label: "Brand", icon: Palette },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  authenticated,
  bare = false,
}: {
  children: React.ReactNode;
  authenticated: boolean;
  bare?: boolean;
}) {
  return (
    <div className="min-h-screen bg-shell-50">
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-shell-200 bg-white px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-shell-900">
            Invoice Studio
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-shell-500 transition hover:bg-shell-100 hover:text-shell-900"
              >
                <item.icon className="size-3.5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-shell-500 sm:inline">
            {authenticated ? "Cloud sync on" : "Guest mode · saved in this browser"}
          </span>
          <Link
            href={authenticated ? "/dashboard/settings" : "/sign-in"}
            className="rounded-lg border border-shell-200 px-3 py-1.5 text-xs font-medium text-shell-900 hover:bg-shell-100"
          >
            {authenticated ? "Account" : "Sign in"}
          </Link>
        </div>
      </header>
      {bare ? children : <main className="mx-auto max-w-6xl">{children}</main>}
    </div>
  );
}
