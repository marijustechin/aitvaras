import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("..", import.meta.url));

function readSource(...relative: string[]): string {
  return readFileSync(join(srcDir, ...relative), "utf8");
}

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (entry.name.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Lithuanian UI terminology", () => {
  it("uses Vaidmenys on the profile page", () => {
    const source = readSource("app", "profile", "page.tsx");
    expect(source).toContain("Vaidmenys");
    expect(source).not.toMatch(/\bRolės\b/);
  });

  it("uses Vaidmenys on the admin users page", () => {
    const source = readSource("app", "admin", "users", "page.tsx");
    expect(source).toContain("Vaidmenys");
    expect(source).not.toMatch(/\bRolės\b/);
  });

  it("uses Būsena for the users status column", () => {
    const source = readSource("app", "admin", "users", "page.tsx");
    expect(source).toContain("Būsena");
    expect(source).not.toMatch(/\bStatusas\b|\bStatusai\b/);
  });

  it("renders no legacy Lithuanian role/status terminology anywhere in the UI", () => {
    const files = [
      ...collectSourceFiles(join(srcDir, "app")),
      ...collectSourceFiles(join(srcDir, "components")),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\bRolė\b|\bRolės\b/);
      expect(source, file).not.toMatch(/\bStatusas\b|\bStatusai\b/);
    }
  });
});
