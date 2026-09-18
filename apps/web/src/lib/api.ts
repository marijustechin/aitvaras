const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

const TOKEN_STORAGE_KEY = "aitvaras.accessToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Minimal fetch wrapper for the Aitvaras API.
 *
 * NOTE: the access token is kept in localStorage for this initial foundation.
 * Moving it to an http-only cookie (via a Next.js route handler) is a planned
 * hardening step; see docs/authentication.md.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");

  const token = getAccessToken();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // Non-JSON error body.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
