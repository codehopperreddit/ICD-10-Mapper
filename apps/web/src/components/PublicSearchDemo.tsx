"use client";

import { useState } from "react";
import type { IcdMatch, SearchResponse } from "@icd-mapper/shared";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://icd-mapper-api.workers.dev";

const EXAMPLES = [
  "type 2 diabetes with neuropathy",
  "acute myocardial infarction",
  "broken left wrist",
  "covid-19 pneumonia",
  "major depressive disorder, recurrent",
  "essential hypertension",
];

export function PublicSearchDemo() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<IcdMatch[] | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [remaining, setRemaining] = useState<number | null>(null);

  async function runSearch(query: string) {
    const text = query.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setLastQuery(text);
    try {
      const res = await fetch(
        `${API_URL}/api/public/search?q=${encodeURIComponent(text)}&limit=5`,
        { cache: "no-store" }
      );
      const rem = res.headers.get("X-RateLimit-Remaining");
      if (rem !== null) setRemaining(Number(rem));
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as SearchResponse;
      setResults(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(q);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-200 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          <SearchIcon />
          <input
            className="w-full bg-transparent py-3 text-base text-slate-900 placeholder-slate-400 focus:outline-none"
            placeholder="Describe a diagnosis, e.g. type 2 diabetes with neuropathy"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="btn-primary px-6 py-3 text-base disabled:opacity-60"
          disabled={loading || !q.trim()}
        >
          {loading ? "Searching…" : "Map to ICD-10"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQ(ex);
              void runSearch(ex);
            }}
            className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200"
          >
            {ex}
          </button>
        ))}
      </div>

      {(results || error || loading) && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs">
            <span className="font-medium text-slate-600">
              {loading ? "Searching…" : lastQuery ? `Results for "${lastQuery}"` : "Results"}
            </span>
            {remaining !== null && (
              <span className="text-slate-500">
                {remaining} free {remaining === 1 ? "lookup" : "lookups"} left today
              </span>
            )}
          </div>

          {loading && (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="p-5 text-sm text-red-700">
              <p className="font-semibold">Couldn&apos;t complete the search</p>
              <p className="mt-1 text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && results && results.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              No matches found. Try a more specific clinical description.
            </div>
          )}

          {!loading && !error && results && results.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {results.map((m, i) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      {i + 1}
                    </span>
                    <code className="rounded bg-brand-50 px-2 py-1 font-mono text-sm font-semibold text-brand-700">
                      {m.code}
                    </code>
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="text-slate-900">{m.description}</p>
                    {m.chapter && (
                      <p className="mt-0.5 text-xs text-slate-500">{m.chapter}</p>
                    )}
                  </div>
                  <ConfidenceBar value={m.confidence} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-slate-400";
  return (
    <div className="flex shrink-0 items-center gap-2 sm:w-32">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${tone} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs text-slate-600">
        {pct}%
      </span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
