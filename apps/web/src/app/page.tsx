import Link from "next/link";
import { TIERS } from "@icd-mapper/shared";

export const runtime = "edge";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Hero />
      <Features />
      <Pricing />
      <PaymentRegions />
      <Footer />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="text-lg font-bold tracking-tight">
        ICD<span className="text-brand-600">·</span>Mapper
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link href="#features" className="text-slate-700 hover:text-brand-600">Features</Link>
        <Link href="#pricing" className="text-slate-700 hover:text-brand-600">Pricing</Link>
        <Link href="/sign-in" className="btn-secondary">Sign in</Link>
        <Link href="/sign-up" className="btn-primary">Get started</Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-600">
        ICD-10-CM 2024 · 70,000+ codes
      </p>
      <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
        Map any diagnosis to the right ICD-10 code in milliseconds.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
        Drop in free-text diagnoses or upload a CSV. Get ranked ICD-10-CM codes back, every time —
        backed by SQLite FTS5 fuzzy search at the edge.
      </p>
      <div className="mt-10 flex justify-center gap-3">
        <Link href="/sign-up" className="btn-primary px-6 py-3 text-base">
          Try it free
        </Link>
        <Link href="#pricing" className="btn-secondary px-6 py-3 text-base">
          View pricing
        </Link>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "Edge-fast fuzzy search",
    body: "FTS5 over the full ICD-10-CM index, served from Cloudflare's global D1 replica.",
  },
  {
    title: "Bulk CSV mapping",
    body: "Upload a CSV with a `diagnosis_text` column; get a ranked CSV back in seconds.",
  },
  {
    title: "Simple REST API",
    body: "One bearer token, JSON in / JSON out. Drop it into your EHR or RCM workflow.",
  },
  {
    title: "Confidence scoring",
    body: "Every match comes with a normalized BM25 confidence so you can flag low-trust rows.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-3xl font-bold tracking-tight">Built for billing & coding teams</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { id: "free", featured: false, perks: ["50 lookups / day", "Single search", "Up to 100 rows / CSV"] },
    { id: "pro",  featured: true,  perks: ["5,000 lookups / day", "Bulk CSV up to 10k rows", "API keys"] },
    { id: "api",  featured: false, perks: ["10,000 lookups / day", "Bulk CSV up to 100k rows", "Priority support"] },
  ] as const;

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-3xl font-bold tracking-tight text-center">Simple pricing</h2>
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {tiers.map((t) => {
          const cfg = TIERS[t.id];
          return (
            <div
              key={t.id}
              className={`card flex flex-col ${t.featured ? "ring-2 ring-brand-500" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold">{cfg.label}</h3>
                <span className="text-2xl font-bold">{cfg.price}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-slate-600">
                {t.perks.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-brand-600">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`mt-8 ${t.featured ? "btn-primary" : "btn-secondary"}`}
              >
                {t.id === "free" ? "Start free" : "Choose plan"}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PaymentRegions() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="card flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-around sm:text-left">
        <div>
          <h3 className="font-semibold">International customers</h3>
          <p className="text-sm text-slate-600">Pay in USD via Paddle (Merchant of Record).</p>
        </div>
        <div className="hidden h-12 w-px bg-slate-200 sm:block" />
        <div>
          <h3 className="font-semibold">India customers</h3>
          <p className="text-sm text-slate-600">Pay in INR via Razorpay (UPI, cards, netbanking).</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-500">
      <div className="flex justify-between">
        <span>© {new Date().getFullYear()} ICD Mapper</span>
        <span>Built on Cloudflare · Pages · Workers · D1 · R2</span>
      </div>
    </footer>
  );
}
