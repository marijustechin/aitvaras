export interface PasswordFieldState {
  /** `type` attribute for the password input. */
  inputType: "password" | "text";
  /** Which icon reflects the current visibility state. */
  icon: "eye" | "eye-off";
  /** Accessible label for the toggle button. */
  ariaLabel: string;
}

/**
 * Password visibility control state (domain-agnostic UI helper).
 *
 * The visible icon reflects the **current** state: a crossed-out eye when the
 * password is hidden, an open eye when it is visible.
 */
export function passwordFieldState(visible: boolean): PasswordFieldState {
  return visible
    ? { inputType: "text", icon: "eye", ariaLabel: "Slėpti slaptažodį" }
    : { inputType: "password", icon: "eye-off", ariaLabel: "Rodyti slaptažodį" };
}
