import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buttonClass,
  DESTRUCTIVE_BUTTON_CLASS,
  OUTLINE_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECONDARY_NAV_BUTTON_CLASS,
} from "./button";

const srcRoot = fileURLToPath(new URL("../../", import.meta.url));

function readSource(...segments: string[]): string {
  return readFileSync(join(srcRoot, ...segments), "utf8");
}

describe("button hierarchy", () => {
  it("exposes primary as the solid black main action", () => {
    expect(PRIMARY_BUTTON_CLASS).toContain("bg-primary");
    expect(PRIMARY_BUTTON_CLASS).toContain("text-primary-foreground");
  });

  it("exposes secondary as a filled neutral-gray action with white text", () => {
    expect(SECONDARY_BUTTON_CLASS).toContain("bg-neutral-700");
    expect(SECONDARY_BUTTON_CLASS).toContain("text-white");
    // Lighter than black, but a distinct variant.
    expect(SECONDARY_BUTTON_CLASS).not.toBe(PRIMARY_BUTTON_CLASS);
  });

  it("offers a compact secondary navigation variant", () => {
    expect(SECONDARY_NAV_BUTTON_CLASS).toContain("bg-neutral-700");
    expect(SECONDARY_NAV_BUTTON_CLASS).toContain("text-xs");
  });

  it("keeps outline row actions and destructive actions separate", () => {
    expect(OUTLINE_BUTTON_CLASS).toContain("border");
    expect(OUTLINE_BUTTON_CLASS).not.toContain("bg-neutral-700");
    expect(DESTRUCTIVE_BUTTON_CLASS).toContain("bg-destructive");
    expect(DESTRUCTIVE_BUTTON_CLASS).not.toContain("bg-neutral-700");
  });

  it("shares a base shape and an optional extra-class hook", () => {
    expect(buttonClass("secondary")).toContain("rounded-md");
    expect(buttonClass("secondary")).toContain("disabled:opacity-60");
    expect(buttonClass("secondary", "md", "mt-2")).toContain("mt-2");
  });
});

describe("button hierarchy adoption (source)", () => {
  it("renders reference-data child actions as secondary buttons", () => {
    const source = readSource(
      "features",
      "manage-resources",
      "ui",
      "resources-page.tsx",
    );
    expect(source).toContain("SECONDARY_NAV_BUTTON_CLASS");
    expect(source).toContain('href="/resources/categories"');
    expect(source).toContain('href="/resources/packaging-types"');
  });

  it("renders page back actions as the shared secondary variant", () => {
    for (const file of [
      ["features", "manage-resource-categories", "ui", "resource-categories-page.tsx"],
      ["features", "manage-packaging-types", "ui", "packaging-types-page.tsx"],
    ]) {
      const source = readSource(...file);
      expect(source, file.join("/")).toContain("SECONDARY_NAV_BUTTON_CLASS");
    }
  });

  it("uses primary for main actions and destructive for void in receiving", () => {
    const source = readSource(
      "features",
      "manage-batches",
      "ui",
      "receiving-delivery.tsx",
    );
    expect(source).toContain("PRIMARY_BUTTON_CLASS");
    expect(source).toContain("SECONDARY_BUTTON_CLASS");
    expect(source).toContain("OUTLINE_BUTTON_CLASS");
    expect(source).toContain("DESTRUCTIVE_BUTTON_CLASS");
  });
});
