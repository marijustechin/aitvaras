/**
 * Minimal application footer.
 *
 * The version is not hardcoded here: it comes from the single canonical source
 * (the workspace root `package.json`) injected at build time via
 * `next.config.ts` as `NEXT_PUBLIC_APP_VERSION`.
 */
export function AppFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

  return (
    <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
      © Alfasis UAB · Aitvaras v{version}
    </footer>
  );
}
