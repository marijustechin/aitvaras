import { ApiError } from "@/shared/api";

const WRONG_CREDENTIALS = "Neteisingas naudotojo vardas arba slaptažodis.";
const SERVER_ERROR = "Nepavyko prisijungti prie serverio. Bandykite dar kartą.";

/**
 * Map a login failure to user-facing Lithuanian text.
 *
 * Authentication failures (401: unknown user, wrong password, inactive,
 * locked) are deliberately indistinguishable. Genuine network/server errors
 * get a separate generic technical message.
 */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return WRONG_CREDENTIALS;
  }
  return SERVER_ERROR;
}

/** Development-only login hint visibility. Hidden in production builds. */
export function shouldShowDevLoginHint(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "development";
}
