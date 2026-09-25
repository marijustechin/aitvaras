const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

/** A single field-level validation issue returned by the API. */
export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Stable machine-readable error code, when the API provides one. */
    public readonly code?: string,
    /** Structured validation details, when the API provides them. */
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function parseDetails(value: unknown): ApiErrorDetail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const details = value
    .filter(
      (item): item is { path?: unknown; message?: unknown } =>
        typeof item === "object" && item !== null,
    )
    .map((item) => ({
      path: typeof item.path === "string" ? item.path : "",
      message: typeof item.message === "string" ? item.message : "",
    }));
  return details.length > 0 ? details : undefined;
}

/**
 * Minimal fetch wrapper for the Aitvaras API.
 *
 * Browser authentication is cookie-based: the httpOnly auth cookie is sent
 * automatically with `credentials: "include"`. No token is stored in or read
 * from JavaScript-accessible storage, and no Authorization header is set.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    let details: ApiErrorDetail[] | undefined;
    try {
      const body = (await response.json()) as {
        message?: unknown;
        code?: unknown;
        errors?: unknown;
      };
      if (typeof body.message === "string") {
        message = body.message;
      }
      if (typeof body.code === "string") {
        code = body.code;
      }
      details = parseDetails(body.errors);
    } catch {
      // Non-JSON error body.
    }
    throw new ApiError(response.status, message, code, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
