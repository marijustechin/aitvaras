"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BrandMark, PasswordInput, useToast } from "@/shared/ui";
import { useAuth } from "../model/auth-provider";
import { loginErrorMessage, shouldShowDevLoginHint } from "../lib/login-ui";

/** Login screen composition (pre-authentication; no application shell). */
export function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      router.replace("/");
    } catch (caught) {
      toast.error(loginErrorMessage(caught));
      document.getElementById("username")?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  const showDevHint = shouldShowDevLoginHint();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-3">
        <div className="flex justify-center">
          <BrandMark variant="dark" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Prisijungti</h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-6"
      >
        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium">
            Naudotojo vardas
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Slaptažodis
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "Jungiamasi…" : "Prisijungti"}
        </button>
      </form>

      {showDevHint ? (
        <p className="text-center text-xs text-muted-foreground">
          Lokali paskyra: localdev / localdev
        </p>
      ) : null}
    </main>
  );
}
