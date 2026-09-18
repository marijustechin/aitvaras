import "reflect-metadata";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

const DEFAULT_API_PORT = 3010;
const DEFAULT_WEB_ORIGINS = "http://localhost:3011,http://127.0.0.1:3011";

// Load the workspace-level .env before reading process.env for CORS/port.
for (const candidate of [
  join(process.cwd(), "../../.env"),
  join(process.cwd(), ".env"),
]) {
  try {
    process.loadEnvFile(candidate);
    break;
  } catch {
    // No local .env; rely on the ambient environment.
  }
}

/** Parse and validate a TCP port from configuration. */
function resolvePort(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API_PORT "${raw}": expected an integer 1-65535`);
  }
  return port;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const origins = (process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });

  const port = resolvePort(process.env.API_PORT, DEFAULT_API_PORT);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
