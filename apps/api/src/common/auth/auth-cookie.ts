/**
 * Canonical authentication cookie.
 *
 * The browser never receives a readable token: the JWT is delivered only as an
 * httpOnly cookie. These names are shared by the auth module (set/clear) and
 * the global auth guard (read).
 */
export const AUTH_COOKIE_NAME = "aitvaras_access";
export const AUTH_COOKIE_PATH = "/";
