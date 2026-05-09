/**
 * Tiny client wrapper for the ICD Mapper Worker API.
 *
 * Server components fetch via `apiServer()` (sets Authorization from Clerk).
 * Client components fetch via the `/api/proxy` Next route, which forwards the
 * Clerk session token to the Worker.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://icd-mapper-api.workers.dev";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(typeof body === "object" && body && "message" in body
      ? String((body as { message: unknown }).message)
      : `HTTP ${status}`);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export const api = {
  search(token: string, q: string, limit = 5) {
    const url = `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    return request(url, { token });
  },
  me(token: string) {
    return request("/api/me", { token });
  },
  usage(token: string) {
    return request("/api/me/usage", { token });
  },
  listKeys(token: string) {
    return request("/api/keys", { token });
  },
  createKey(token: string, name: string) {
    return request("/api/keys", {
      method: "POST",
      token,
      body: JSON.stringify({ name }),
    });
  },
  deleteKey(token: string, id: string) {
    return request(`/api/keys/${id}`, { method: "DELETE", token });
  },
  uploadBulk(token: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    return request("/api/bulk-map", { method: "POST", token, body: fd });
  },
  bulkStatus(token: string, jobId: string) {
    return request(`/api/bulk-map/${jobId}`, { token });
  },
};

export { API_URL };
