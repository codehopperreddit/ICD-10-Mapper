"use client";

import { useState } from "react";
import type { IcdMatch, SearchResponse } from "@icd-mapper/shared";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<IcdMatch[] | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
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

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="card flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="e.g. type 2 diabetes with neuropathy"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      {results && results.length === 0 && (
        <div className="card text-slate-500">No matches found.</div>
      )}

      {results && results.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Chapter</th>
                <th className="px-4 py-3 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {results.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono font-medium">{m.code}</td>
                  <td className="px-4 py-3">{m.description}</td>
                  <td className="px-4 py-3 text-slate-500">{m.chapter ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <ConfidenceBar value={m.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-20 overflow-hidden rounded bg-slate-100">
        <span
          className="block h-full bg-brand-600"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-8 text-right text-xs text-slate-600">{pct}%</span>
    </span>
  );
}
