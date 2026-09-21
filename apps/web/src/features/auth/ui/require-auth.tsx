"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { RoleKey } from "@aitvaras/contracts";
import { useAuth } from "../model/auth-provider";

/** Redirects unauthenticated users to /login and enforces optional roles. */
export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: RoleKey[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <p className="p-8 text-sm text-muted-foreground">Kraunama paskyra…</p>
    );
  }

  if (
    roles &&
    roles.length > 0 &&
    !roles.some((role) => user.roles.includes(role))
  ) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold">403 — Prieiga uždrausta</h1>
        <p className="mt-2 text-muted-foreground">
          Jūsų paskyra neturi teisės peržiūrėti šio puslapio.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
