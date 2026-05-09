"use client";

import { useEffect, useState } from "react";
import type { ApiKey, CreateApiKeyResponse } from "@icd-mapper/shared";

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [justCreated, setJustCreated] = useState<{ key: ApiKey; secret: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/api/keys");
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { keys: ApiKey[] };
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/proxy/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CreateApiKeyResponse;
      setJustCreated(data);
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    }
  }

  async function onRevoke(id: string) {
    if (!confirm("Revoke this key? Apps using it will start failing immediately.")) return;
    try {
      const res = await fetch(`/api/proxy/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onCreate} className="card flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Key name (e.g. production-billing)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={80}
        />
        <button className="btn-primary" type="submit">
          Generate key
        </button>
      </form>

      {justCreated && (
        <div className="card border border-amber-200 bg-amber-50">
          <p className="font-semibold text-amber-900">Save this key now — it won&apos;t be shown again.</p>
          <code className="mt-2 block break-all rounded bg-white p-3 font-mono text-sm">
            {justCreated.secret}
          </code>
          <button
            className="btn-secondary mt-3"
            onClick={() => setJustCreated(null)}
          >
            I&apos;ve saved it
          </button>
        </div>
      )}

      {error && (
        <div className="card border border-red-200 bg-red-50 text-red-700">{error}</div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Prefix</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{k.prefix}…</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(k.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => onRevoke(k.id)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
