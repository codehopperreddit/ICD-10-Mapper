import Link from "next/link";
import { TIERS } from "@icd-mapper/shared";
import { PublicSearchDemo } from "@/components/PublicSearchDemo";


export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50">
      <SiteHeader />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <CodeExample />
      <Pricing />
      <PaymentRegions />
      <FinalCta />
      <Footer />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <LogoMark />
          <span>
            ICD<span className="text-brand-600">·</span>Mapper
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm sm:flex">
          <Link href="#features" className="text-slate-600 hover:text-slate-900">Features</Link>
          <Link href="#how" className="text-slate-600 hover:text-slate-900">How it works</Link>
          <Link href="#pricing" className="text-slate-600 hover:text-slate-900">Pricing</Link>
          <Link href="/docs" className="text-slate-600 hover:text-slate-900">API docs</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="btn-secondary">Sign in</Link>
          <Link href="/sign-up" className="btn-primary">Get started</Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate">
      <BackgroundGradient />
      <div className="mx-auto max-w-6xl px-6 pb-12 pt-16 sm:pt-24">
        <div className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            ICD-10-CM 2024 · 70,000+ codes · sub-100ms responses
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Map any diagnosis to the right
            <span className="bg-gradient-to-br from-brand-600 to-brand-900 bg-clip-text text-transparent">
              {" "}ICD-10 code{" "}
            </span>
            in milliseconds.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Drop in free-text diagnoses or upload a CSV. Get ranked ICD-10-CM codes back, every time —
            backed by SQLite FTS5 fuzzy search at the edge.
          </p>
        </div>

        <div className="mt-10">
          <PublicSearchDemo />
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 text-sm text-slate-500 sm:flex-row">
          <span className="inline-flex items-center gap-2">
            <CheckIcon /> No credit card to try
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="inline-flex items-center gap-2">
            <CheckIcon /> 20 free lookups per IP per day
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="inline-flex items-center gap-2">
            <CheckIcon /> Sign up for unlimited
          </span>
        </div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-10 text-center sm:grid-cols-4">
        <Stat value="70k+" label="ICD-10-CM codes indexed" />
        <Stat value="<100ms" label="Average search latency" />
        <Stat value="99.9%" label="Edge uptime (Cloudflare)" />
        <Stat value="100k" label="Rows per CSV upload" />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

const FEATURES = [
  {
    title: "Edge-fast fuzzy search",
    body: "FTS5 over the full ICD-10-CM index, served from Cloudflare's global D1 replica. Typos and partial phrases still match.",
    Icon: BoltIcon,
  },
  {
    title: "Bulk CSV mapping",
    body: "Upload a CSV with a diagnosis_text column. Get a ranked CSV back in seconds with code, description, and confidence.",
    Icon: TableIcon,
  },
  {
    title: "Simple REST API",
    body: "One bearer token, JSON in / JSON out. Drop it into your EHR, RCM workflow, or scribe pipeline.",
    Icon: ApiIcon,
  },
  {
    title: "Confidence scoring",
    body: "Every match comes with a normalized BM25 confidence so your team can flag low-trust rows for human review.",
    Icon: GaugeIcon,
  },
  {
    title: "HIPAA-friendly architecture",
    body: "Stateless edge workers, no PHI persisted beyond ephemeral CSV jobs. Bring your own BAA on the Enterprise plan.",
    Icon: ShieldIcon,
  },
  {
    title: "Built for developers",
    body: "Versioned API keys, per-key usage stats, predictable JSON, and CORS so you can call it from a SPA.",
    Icon: CodeIcon,
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Features</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Built for billing &amp; coding teams
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
          Everything you need to turn free-text clinical descriptions into clean,
          billable ICD-10 codes — without paying for a legacy enterprise suite.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition group-hover:bg-brand-100">
              <f.Icon />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Type or upload",
    body: "Search a single diagnosis from the UI, or upload a CSV with a `diagnosis_text` column.",
  },
  {
    n: "02",
    title: "We rank matches",
    body: "Our FTS5 index over ICD-10-CM 2024 returns the top candidates with normalized confidence scores.",
  },
  {
    n: "03",
    title: "Ship it to your stack",
    body: "Pull results via JSON API, download the enriched CSV, or copy codes into your billing tool.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Three steps from text to ICD-10
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <span className="font-mono text-sm font-semibold text-brand-600">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeExample() {
  const curl = `curl "https://icd-mapper-api.workers.dev/api/search?q=type+2+diabetes+with+neuropathy" \\
  -H "Authorization: Bearer icdm_live_xxxxxxxxxxxx"`;

  const response = `{
  "query": "type 2 diabetes with neuropathy",
  "matches": [
    {
      "code": "E11.40",
      "description": "Type 2 diabetes mellitus with diabetic neuropathy, unspecified",
      "chapter": "Endocrine, nutritional and metabolic diseases",
      "confidence": 1.0
    },
    {
      "code": "E11.42",
      "description": "Type 2 diabetes mellitus with diabetic polyneuropathy",
      "chapter": "Endocrine, nutritional and metabolic diseases",
      "confidence": 0.87
    }
  ],
  "cached": false
}`;

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">For developers</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            One bearer token. Predictable JSON.
          </h2>
          <p className="mt-4 text-base text-slate-600">
            Send a free-text query, get back ranked ICD-10-CM codes with confidence
            scores. Generate keys from the dashboard, scope them per environment,
            and revoke them any time.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/docs" className="btn-primary">Read the API docs</Link>
            <Link href="/sign-up" className="btn-secondary">Get a key</Link>
          </div>
          <ul className="mt-6 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-0.5" /> JSON over HTTPS, CORS enabled
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-0.5" /> Rate limits returned in response headers
            </li>
            <li className="flex items-start gap-2">
              <CheckIcon className="mt-0.5" /> 1-hour edge cache on identical queries
            </li>
          </ul>
        </div>
        <div className="space-y-4">
          <CodeBlock label="Request" code={curl} />
          <CodeBlock label="Response" code={response} />
        </div>
      </div>
    </section>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Pricing() {
  const tiers = [
    {
      id: "free" as const,
      featured: false,
      tagline: "Try it without a credit card",
      perks: [
        "50 lookups / day",
        "Single search UI",
        "CSV uploads up to 100 rows",
        "Community support",
      ],
    },
    {
      id: "pro" as const,
      featured: true,
      tagline: "For growing clinics and billers",
      perks: [
        "5,000 lookups / day",
        "Bulk CSV up to 10,000 rows",
        "API keys with per-key analytics",
        "Email support",
      ],
    },
    {
      id: "api" as const,
      featured: false,
      tagline: "For HealthTech and EHR vendors",
      perks: [
        "10,000 lookups / day",
        "Bulk CSV up to 100,000 rows",
        "Priority support",
        "Higher CSV concurrency",
      ],
    },
  ];

  return (
    <section id="pricing" className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Pricing</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple pricing, scaled by usage
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
            Every plan includes the full ICD-10-CM index, the bulk CSV pipeline,
            and the same low-latency edge infrastructure.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => {
            const cfg = TIERS[t.id];
            return (
              <div
                key={t.id}
                className={`relative flex flex-col rounded-2xl p-7 ${
                  t.featured
                    ? "border-2 border-brand-500 bg-gradient-to-br from-white to-brand-50 shadow-xl"
                    : "border border-slate-200 bg-white shadow-sm"
                }`}
              >
                {t.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow">
                    Most popular
                  </span>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{cfg.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>
                </div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900">
                    {cfg.price.split("/")[0]}
                  </span>
                  {cfg.price.includes("/") && (
                    <span className="text-sm text-slate-500">
                      /{cfg.price.split("/")[1]}
                    </span>
                  )}
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {t.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-slate-700">
                      <CheckIcon className="mt-0.5 text-brand-600" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`mt-8 ${t.featured ? "btn-primary" : "btn-secondary"}`}
                >
                  {t.id === "free" ? "Start free" : `Choose ${cfg.label}`}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PaymentRegions() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="card flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-around sm:text-left">
        <div>
          <h3 className="text-base font-semibold text-slate-900">International customers</h3>
          <p className="mt-1 text-sm text-slate-600">
            Pay in USD via Paddle. They handle VAT/GST and act as the Merchant of Record.
          </p>
        </div>
        <div className="hidden h-12 w-px bg-slate-200 sm:block" />
        <div>
          <h3 className="text-base font-semibold text-slate-900">India customers</h3>
          <p className="mt-1 text-sm text-slate-600">
            Pay in INR via Razorpay — UPI, cards, netbanking, and wallets supported.
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-center text-white sm:p-16">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stop hand-coding. Start mapping.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-brand-50">
            Start with the free tier — no credit card required. Upgrade only when
            your volume needs it.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-md bg-white px-6 py-3 text-base font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              Create a free account
            </Link>
            <Link
              href="/docs"
              className="rounded-md bg-brand-800/40 px-6 py-3 text-base font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-brand-800/60"
            >
              Read the API docs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="font-medium text-slate-700">
            ICD<span className="text-brand-600">·</span>Mapper
          </span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/docs" className="hover:text-slate-900">Docs</Link>
          <Link href="#pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/sign-in" className="hover:text-slate-900">Sign in</Link>
          <span>Built on Cloudflare</span>
        </div>
      </div>
    </footer>
  );
}

function BackgroundGradient() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 -z-10 h-[600px] overflow-hidden"
    >
      <div className="absolute left-1/2 top-0 h-[400px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-100 via-brand-50 to-transparent opacity-60 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-[400px] bg-[linear-gradient(to_bottom,#fff,transparent)]" />
    </div>
  );
}

function LogoMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 12h4l3 8 4-16 3 8h2" />
      </svg>
    </span>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-emerald-500 ${className}`}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}
function ApiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 4-6 8 6 8M16 4l6 8-6 8M14 4l-4 16" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 14 8 10M3.5 14a9 9 0 1 1 17 0" />
      <circle cx="12" cy="14" r="1.5" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}
