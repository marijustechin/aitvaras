"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { BrandMark } from "@/components/brand-mark";
import { PasswordInput } from "@/components/password-input";
import { loginErrorMessage, shouldShowDevLoginHint } from "@/lib/login-ui";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ username: username.trim(), password });
      router.replace("/");
    } catch (caught) {
      setError(loginErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const showDevHint = shouldShowDevLoginHint();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-3">
        <BrandMark />
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

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

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
