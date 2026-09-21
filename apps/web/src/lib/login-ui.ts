import { ApiError } from "./api";

export interface PasswordFieldState {
  /** `type` attribute for the password input. */
  inputType: "password" | "text";
  /** Which icon reflects the current visibility state. */
  icon: "eye" | "eye-off";
  /** Accessible label for the toggle button. */
  ariaLabel: string;
}

/**
 * Password visibility control state.
 *
 * The visible icon reflects the **current** state: a crossed-out eye when the
 * password is hidden, an open eye when it is visible.
 */
export function passwordFieldState(visible: boolean): PasswordFieldState {
  return visible
    ? { inputType: "text", icon: "eye", ariaLabel: "Slėpti slaptažodį" }
    : { inputType: "password", icon: "eye-off", ariaLabel: "Rodyti slaptažodį" };
}

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
