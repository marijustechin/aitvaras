"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { BrandMark } from "@/components/brand-mark";
import {
  loginErrorMessage,
  passwordFieldState,
  shouldShowDevLoginHint,
} from "@/lib/login-ui";

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M9.9 4.24A9.8 9.8 0 0 1 12 4c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.14 4.24M6.6 6.6A17.5 17.5 0 0 0 2 11s3.5 7 10 7a9.8 9.8 0 0 0 3.4-.6" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const field = passwordFieldState(showPassword);
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
          <div className="relative">
            <input
              id="password"
              name="password"
              type={field.inputType}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={field.ariaLabel}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {field.icon === "eye" ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
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
