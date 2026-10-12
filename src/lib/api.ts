'use client';

/** Browser-side fetch helper. Unwraps the { error: { message } } shape route() returns. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const response = await fetch(path, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    // Balances must never come from a cache (rule 8).
    cache: 'no-store',
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload.error as { message?: string; code?: string; details?: Record<string, string[]> })
        : null;
    throw new ApiError(
      response.status,
      error?.message ?? 'Something went wrong',
      error?.code,
      error?.details,
    );
  }

  return payload as T;
}
