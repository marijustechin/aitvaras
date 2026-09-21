import fastifyCookie from "@fastify/cookie";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

const DEFAULT_WEB_ORIGINS = "http://localhost:3011,http://127.0.0.1:3011";

/**
 * Resolve the allowed web origins for credentialed CORS.
 *
 * Credentials are enabled, so a wildcard is never allowed: origins must be an
 * explicit, comma-separated list from `WEB_ORIGIN`.
 */
export function resolveWebOrigins(
  raw: string | undefined = process.env.WEB_ORIGIN,
): string[] {
  const origins = (raw ?? DEFAULT_WEB_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error(
      'WEB_ORIGIN must list explicit origins without "*" because credentialed CORS is enabled',
    );
  }
  return origins;
}

/**
 * Shared application configuration used by both the runtime entrypoint and
 * integration tests: registers cookie parsing and credentialed CORS.
 */
export async function configureApp(
  app: NestFastifyApplication,
): Promise<void> {
  await app.register(fastifyCookie);
  app.enableCors({ origin: resolveWebOrigins(), credentials: true });
}
