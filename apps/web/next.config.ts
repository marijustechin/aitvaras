import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

/**
 * Read the canonical Aitvaras version from the workspace root `package.json`
 * (single source of truth). `next` scripts run with cwd = apps/web, but running
 * from the repository root is also supported. Only the workspace package named
 * "aitvaras" is accepted.
 */
function readAppVersion(): string {
  for (const candidate of [
    resolve(process.cwd(), "package.json"),
    resolve(process.cwd(), "../../package.json"),
  ]) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === "aitvaras" && typeof pkg.version === "string") {
        return pkg.version;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return "0.0.0";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Expose the version as a build-time constant (no runtime lookup).
  env: {
    NEXT_PUBLIC_APP_VERSION: readAppVersion(),
  },
};

export default nextConfig;
