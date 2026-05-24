import Link from "next/link";

export const runtime = "edge";

export const metadata = {
  title: "API Docs — ICD Mapper",
  description: "REST API reference for the ICD Mapper service.",
};

// The API is served same-origin from this Pages app (e.g. https://icd-mapper.pages.dev/api/*).
const API_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://icd-mapper.pages.dev";

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <DocsHeader />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            <TocLink href="#overview">Overview</TocLink>
            <TocLink href="#auth">Authentication</TocLink>
            <TocLink href="#search">Search</TocLink>
            <TocLink href="#public-search">Public search</TocLink>
            <TocLink href="#bulk">Bulk CSV</TocLink>
            <TocLink href="#keys">API keys</TocLink>
            <TocLink href="#errors">Errors</TocLink>
            <TocLink href="#rate-limits">Rate limits</TocLink>
          </nav>
        </aside>

        <article className="prose max-w-none space-y-12">
          <Section id="overview" title="Overview">
            <p>
              ICD Mapper is a REST API for converting free-text clinical
              descriptions into ranked <strong>ICD-10-CM</strong> codes. The API
              is hosted on Cloudflare Workers, runs at the edge globally, and
              returns JSON over HTTPS.
            </p>
            <KeyVal label="Base URL" value={API_URL} mono />
            <KeyVal label="Content type" value="application/json" mono />
            <KeyVal label="Auth" value="Bearer token (Clerk session or API key)" />
          </Section>

          <Section id="auth" title="Authentication">
            <p>
              Send your bearer token as the <code>Authorization</code> header.
              You can use either a Clerk session JWT (when calling from the
              dashboard) or an API key (recommended for server-to-server).
            </p>
            <Code label="Authorization header">{`Authorization: Bearer icdm_live_xxxxxxxxxxxxxxxx`}</Code>
            <p>
              Generate keys from the{" "}
              <Link href="/dashboard/keys" className="text-brand-700 underline">
                API keys page
              </Link>{" "}
              in your dashboard. Keys are shown <strong>once</strong> on
              creation — store them somewhere safe.
            </p>
          </Section>

          <Section id="search" title="Search — single query">
            <Endpoint method="GET" path="/api/search" />
            <p>Returns the top ICD-10-CM matches for a free-text diagnosis.</p>
            <ParamTable
              rows={[
                ["q", "string", "required", "Free-text diagnosis (max 200 chars)."],
                ["limit", "number", "optional", "1–20, default 5."],
              ]}
            />
            <Code label="Request">{`curl "${API_URL}/api/search?q=type+2+diabetes+with+neuropathy&limit=3" \\
  -H "Authorization: Bearer icdm_live_xxxxxxxxxxxxxxxx"`}</Code>
            <Code label="Response 200">{`{
  "query": "type 2 diabetes with neuropathy",
  "matches": [
    {
      "id": 12345,
      "code": "E11.40",
      "description": "Type 2 diabetes mellitus with diabetic neuropathy, unspecified",
      "category": "E11",
      "chapter": "Endocrine, nutritional and metabolic diseases",
      "confidence": 1.0
    }
  ],
  "cached": false
}`}</Code>
          </Section>

          <Section id="public-search" title="Public search (demo)">
            <Endpoint method="GET" path="/api/public/search" />
            <p>
              Same response shape as <code>/api/search</code>, but{" "}
              <strong>no authentication required</strong>. Rate-limited per IP
              (20 lookups / day). Intended for evaluation and the embedded
              landing-page demo.
            </p>
            <Code label="Request">{`curl "${API_URL}/api/public/search?q=broken+left+wrist"`}</Code>
          </Section>

          <Section id="bulk" title="Bulk CSV mapping">
            <Endpoint method="POST" path="/api/bulk-map" />
            <p>
              Upload a CSV (multipart/form-data, field name <code>file</code>)
              containing a <code>diagnosis_text</code> column. Returns a job ID
              you can poll.
            </p>
            <Code label="Request">{`curl -X POST "${API_URL}/api/bulk-map" \\
  -H "Authorization: Bearer icdm_live_xxxxxxxxxxxxxxxx" \\
  -F "file=@diagnoses.csv"`}</Code>
            <Code label="Response 202">{`{
  "job": {
    "id": "abc123",
    "status": "queued",
    "row_count": 4250,
    "created_at": "2024-05-01T12:34:56Z"
  },
  "uploadInstructions": "Poll GET /api/bulk-map/abc123 for status."
}`}</Code>
            <Endpoint method="GET" path="/api/bulk-map/{jobId}" />
            <p>
              Poll for status. When <code>status</code> is <code>completed</code>,
              the response includes a <code>downloadUrl</code> with a signed
              token (valid for ~10 minutes).
            </p>
          </Section>

          <Section id="keys" title="API keys">
            <Endpoint method="GET" path="/api/keys" />
            <p>List active keys for the authenticated user.</p>
            <Endpoint method="POST" path="/api/keys" />
            <p>
              Create a new key. The plaintext value is returned exactly once in{" "}
              the <code>secret</code> field — store it immediately.
            </p>
            <Endpoint method="DELETE" path="/api/keys/{keyId}" />
            <p>Revoke a key. Apps using it start failing immediately.</p>
          </Section>

          <Section id="errors" title="Errors">
            <p>
              All errors return a JSON body with an <code>error</code> code and a
              human <code>message</code>. Common cases:
            </p>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2">Status</th>
                  <th className="py-2">Error</th>
                  <th className="py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <ErrRow code="400" name="bad_request" when="Missing/invalid query parameters or CSV columns." />
                <ErrRow code="401" name="unauthorized" when="Missing, expired, or invalid bearer token." />
                <ErrRow code="403" name="forbidden" when="Tier doesn't allow this operation (e.g. Free tier creating API keys)." />
                <ErrRow code="403" name="tier_limit" when="CSV exceeds your tier's max row count." />
                <ErrRow code="404" name="not_found" when="Unknown route or job ID." />
                <ErrRow code="413" name="bad_request" when="CSV upload exceeds 25 MB." />
                <ErrRow code="429" name="rate_limited" when="Daily quota exceeded for your tier or IP." />
              </tbody>
            </table>
          </Section>

          <Section id="rate-limits" title="Rate limits">
            <p>
              Every response includes rate-limit headers so you don&apos;t need to
              maintain your own counter:
            </p>
            <Code label="Response headers">{`X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4871
X-RateLimit-Reset: 1730764800`}</Code>
            <p>
              <code>Reset</code> is a Unix timestamp (seconds) marking the start
              of the next UTC day, when your counter resets.
            </p>
          </Section>

          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
            <h3 className="text-lg font-semibold text-brand-900">Need higher limits?</h3>
            <p className="mt-1 text-sm text-brand-800">
              Upgrade to Pro or API tier for higher daily quotas and bulk CSV
              capacity — or talk to us about Enterprise.
            </p>
            <Link href="/sign-up" className="btn-primary mt-4 inline-flex">
              Get started free
            </Link>
          </div>
        </article>
      </div>
    </main>
  );
}

function DocsHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          ICD<span className="text-brand-600">·</span>Mapper
          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Docs
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="btn-secondary">Back to site</Link>
          <Link href="/sign-up" className="btn-primary">Get API key</Link>
        </div>
      </div>
    </header>
  );
}

function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block rounded-md px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </a>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4 space-y-4 text-slate-700">{children}</div>
    </section>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const tone =
    method === "POST"
      ? "bg-emerald-100 text-emerald-800"
      : method === "DELETE"
        ? "bg-red-100 text-red-800"
        : "bg-brand-100 text-brand-800";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 font-mono text-sm">
      <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${tone}`}>
        {method}
      </span>
      <code className="text-slate-800">{path}</code>
    </div>
  );
}

function ParamTable({ rows }: { rows: Array<[string, string, string, string]> }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
        <tr>
          <th className="py-2 pr-4">Param</th>
          <th className="py-2 pr-4">Type</th>
          <th className="py-2 pr-4">Required</th>
          <th className="py-2">Description</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(([name, type, req, desc]) => (
          <tr key={name}>
            <td className="py-2 pr-4 font-mono text-slate-900">{name}</td>
            <td className="py-2 pr-4 text-slate-500">{type}</td>
            <td className="py-2 pr-4 text-slate-500">{req}</td>
            <td className="py-2 text-slate-700">{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ErrRow({ code, name, when }: { code: string; name: string; when: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 font-mono text-slate-900">{code}</td>
      <td className="py-2 pr-4 font-mono text-slate-500">{name}</td>
      <td className="py-2 text-slate-700">{when}</td>
    </tr>
  );
}

function Code({ label, children }: { label: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-slate-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function KeyVal({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
      <span className="w-24 text-xs uppercase tracking-wider text-slate-500">{label}</span>
      <span className={mono ? "font-mono text-slate-800" : "text-slate-800"}>{value}</span>
    </div>
  );
}
