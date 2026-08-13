import { getSessionItem } from '@/lib/session-storage';

/**
 * Base URL of the existing Axinfra production API (the same Next.js app the
 * web frontend talks to). Set per-environment in .env — see .env.example.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const SESSION_TOKEN_KEY = 'axinfra_session_token';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Every route in this API responds `{ success, data?, error? }` — see any
 * route.ts in the web repo's src/app/api/**. apiFetch<T> below unwraps this
 * envelope for callers, so `T` should be the *inner* data shape, not the
 * envelope itself (e.g. `apiFetch<Project[]>('/api/projects')` resolves
 * straight to the array, matching what the route puts in `data`). */
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function isEnvelope(body: unknown): body is ApiEnvelope<unknown> {
  return !!body && typeof body === 'object' && 'success' in body;
}

/**
 * Thin fetch wrapper shared by every API call in the app.
 *
 * Attaches the stored session JWT as `Authorization: Bearer <token>`.
 * This mirrors the cookie-based session the web app uses, but native apps
 * can't rely on cookie persistence the same way — see MOBILE_APP_SETUP.md
 * §3.1 in the web repo for the corresponding backend change
 * (Bearer-token support alongside the existing cookie auth).
 */
export async function apiFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and point it at your API.'
    );
  }

  const token = await getSessionItem(SESSION_TOKEN_KEY);

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok || (isEnvelope(body) && !body.success)) {
    const message = isEnvelope(body) ? body.error : undefined;
    throw new ApiError(res.status, body, message);
  }

  return (isEnvelope(body) ? body.data : body) as T;
}
