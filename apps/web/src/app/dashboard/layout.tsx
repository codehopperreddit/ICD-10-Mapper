import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export const runtime = "edge";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: HomeIcon },
  { href: "/dashboard/search", label: "Search", icon: SearchIcon },
  { href: "/dashboard/bulk", label: "Bulk CSV", icon: TableIcon },
  { href: "/dashboard/keys", label: "API keys", icon: KeyIcon },
  { href: "/dashboard/billing", label: "Billing", icon: CardIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-6 sm:flex sm:flex-col">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <LogoMark />
          <span>
            ICD<span className="text-brand-600">·</span>Mapper
          </span>
        </Link>
        <nav className="mt-10 flex flex-1 flex-col gap-1 text-sm">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} Icon={n.icon}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link
          href="/docs"
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <span className="block font-semibold">API docs</span>
          <span className="mt-0.5 block">REST reference and code examples.</span>
        </Link>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 sm:hidden">
            <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
              <LogoMark />
              <span>ICD<span className="text-brand-600">·</span>Mapper</span>
            </Link>
          </div>
          <span className="hidden text-sm font-medium text-slate-500 sm:block">Dashboard</span>
          <UserButton afterSignOutUrl="/" />
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 text-sm sm:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="mx-auto max-w-5xl p-4 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  Icon,
  children,
}: {
  href: string;
  Icon: () => React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100 hover:text-brand-700"
    >
      <span className="text-slate-400"><Icon /></span>
      {children}
    </Link>
  );
}

function LogoMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12h4l3 8 4-16 3 8h2" />
      </svg>
    </span>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.3-9.3M16 6l3 3M14 8l3 3" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h2" />
    </svg>
  );
}
