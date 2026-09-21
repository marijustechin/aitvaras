"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_LABELS,
  type AuthenticatedUser,
} from "@aitvaras/contracts";
import { AppShell } from "@/components/layout/app-shell";
import { PasswordInput } from "@/components/password-input";
import { isUnauthorized, useAuth } from "@/components/auth-provider";
import { ApiError, apiFetch } from "@/lib/api";

export default function ProfilePage() {
  return (
    <AppShell>
      <Profile />
    </AppShell>
  );
}

function Profile() {
  const { user, replaceUser, clearSession } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  function handleError(
    caught: unknown,
    setError: (message: string) => void,
  ): void {
    if (isUnauthorized(caught)) {
      clearSession();
      router.replace("/login");
      return;
    }
    setError(
      caught instanceof ApiError
        ? caught.message
        : "Nepavyko atnaujinti. Bandykite dar kartą.",
    );
  }

  async function saveName(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setNameStatus(null);
    setNameError(null);

    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) {
      setNameError("Įveskite vardą.");
      return;
    }
    if (!last) {
      setNameError("Įveskite pavardę.");
      return;
    }

    setSavingName(true);
    try {
      const updated = await apiFetch<AuthenticatedUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName: first, lastName: last }),
      });
      replaceUser(updated);
      setFirstName(updated.firstName);
      setLastName(updated.lastName);
      setNameStatus("Išsaugota.");
    } catch (caught) {
      handleError(caught, setNameError);
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setPasswordStatus(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Įveskite dabartinį slaptažodį.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Naujas slaptažodis turi būti bent 8 simboliai.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Slaptažodžiai nesutampa.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch<AuthenticatedUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Slaptažodis pakeistas.");
    } catch (caught) {
      handleError(caught, setPasswordError);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mano profilis</h1>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Paskyros informacija</h2>
        <form onSubmit={saveName} className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Vardas</span>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Pavardė</span>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="space-y-1 text-sm">
            <span className="font-medium">Naudotojo vardas</span>
            <p className="rounded-md border border-input bg-muted px-3 py-2 font-mono text-muted-foreground">
              {user.username}
            </p>
            <p className="text-xs text-muted-foreground">
              Naudotojo vardo keisti negalima.
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <span className="font-medium">Vaidmenys</span>
            <p className="text-muted-foreground">
              {user.roles.map((role) => ROLE_LABELS[role]).join(", ")}
            </p>
          </div>

          {nameError ? (
            <p role="alert" className="text-sm text-destructive">
              {nameError}
            </p>
          ) : null}
          {nameStatus ? (
            <p className="text-sm text-muted-foreground">{nameStatus}</p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={savingName}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {savingName ? "Saugoma…" : "Išsaugoti"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium">Keisti slaptažodį</h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Dabartinis slaptažodis</span>
            <PasswordInput
              autoComplete="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Naujas slaptažodis</span>
            <PasswordInput
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Pakartokite naują slaptažodį</span>
            <PasswordInput
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </label>

          {passwordError ? (
            <p role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          ) : null}
          {passwordStatus ? (
            <p className="text-sm text-muted-foreground">{passwordStatus}</p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {savingPassword ? "Keičiama…" : "Keisti slaptažodį"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
