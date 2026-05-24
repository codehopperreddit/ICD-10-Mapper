export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

export function apiError(
  error: string,
  message: string,
  status: number,
  headers?: Record<string, string>
): Response {
  return json({ error, message }, status, headers);
}
