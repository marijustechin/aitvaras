"use client";

import type { ReactNode } from "react";
import type { RoleKey } from "@aitvaras/contracts";
import { RequireAuth } from "@/components/require-auth";
import { AppHeader } from "./app-header";

/**
 * Authenticated application shell: sticky top bar, content area, footer (the
 * footer is rendered once by the root layout). Use on every authenticated page
 * so the header is not duplicated per page.
 */
export function AppShell({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: RoleKey[];
}) {
  return (
    <RequireAuth roles={roles}>
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </RequireAuth>
  );
}
