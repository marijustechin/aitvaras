"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@aitvaras/contracts";
import { useAuth } from "@/components/auth-provider";
import { BrandMark } from "@/components/brand-mark";
import { RequireAuth } from "@/components/require-auth";

export default function HomePage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <RequireAuth>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <BrandMark href="/" />
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Sandėlio aplikacija
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Atsijungti
          </button>
        </header>

        <section className="space-y-3 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium">Paskyra</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Vardas, pavardė</dt>
              <dd>{user ? `${user.firstName} ${user.lastName}` : ""}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Naudotojo vardas</dt>
              <dd className="font-mono">@{user?.username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Rolės</dt>
              <dd>{user?.roles.map((role) => ROLE_LABELS[role]).join(", ")}</dd>
            </div>
          </dl>
        </section>

        {user?.roles.includes("ADMIN") ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Administravimas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tvarkykite naudotojų paskyras ir prieigas.
            </p>
            <Link
              href="/admin/users"
              className="mt-4 inline-block rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Tvarkyti naudotojus
            </Link>
          </section>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Tai Aitvaro identiteto ir prieigos pagrindas. Verslo funkcijos dar
          neįgyvendintos.
        </p>
      </main>
    </RequireAuth>
  );
}
