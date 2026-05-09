import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export const runtime = "edge";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-6 sm:block">
        <Link href="/" className="text-lg font-bold tracking-tight">
          ICD<span className="text-brand-600">·</span>Mapper
        </Link>
        <nav className="mt-8 flex flex-col gap-1 text-sm">
          <NavLink href="/dashboard">Overview</NavLink>
          <NavLink href="/dashboard/search">Search</NavLink>
          <NavLink href="/dashboard/bulk">Bulk CSV</NavLink>
          <NavLink href="/dashboard/keys">API keys</NavLink>
          <NavLink href="/dashboard/billing">Billing</NavLink>
        </nav>
      </aside>
      <main className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-500">Dashboard</span>
          <UserButton afterSignOutUrl="/" />
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-brand-700"
    >
      {children}
    </Link>
  );
}
