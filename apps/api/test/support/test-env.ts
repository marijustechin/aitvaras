import { createConnection } from "node:net";
import { join } from "node:path";

/** Load the workspace root `.env` into process.env if not already present. */
export function loadWorkspaceEnv(): void {
  if (process.env.DATABASE_URL) {
    return;
  }
  for (const candidate of [
    join(process.cwd(), "../../.env"),
    join(process.cwd(), ".env"),
  ]) {
    try {
      process.loadEnvFile(candidate);
      return;
    } catch {
      // Try the next candidate.
    }
  }
}

/** Best-effort TCP check so database integration tests can skip when absent. */
export async function isDatabaseReachable(): Promise<boolean> {
  loadWorkspaceEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    const port = Number(parsed.port || 5432);
    return await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host: parsed.hostname, port });
      socket.setTimeout(1500);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    });
  } catch {
    return false;
  }
}
