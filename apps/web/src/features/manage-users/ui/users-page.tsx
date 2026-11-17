"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_KEYS,
  ROLE_LABELS,
  type RoleKey,
  type UserSummary,
} from "@aitvaras/contracts";
import { userRolesSummary } from "@/entities/user";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { inactiveRowClass, toggleActionClass } from "@/shared/lib/row-styles";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { focusField } from "@/shared/lib/form-feedback";
import { PasswordInput, SectionTabs, useToast } from "@/shared/ui";
import {
  activeToggleLabel,
  applyUserUpdate,
  CLOSED_PASSWORD_RESET_PANEL,
  closePasswordResetPanel,
  isRoleControlDisabled,
  MIN_PASSWORD_LENGTH,
  openPasswordResetPanel,
  passwordResetError,
  passwordResetErrorMessage,
  passwordResetPayload,
  passwordTooShortMessage,
  toggleRoleSelection,
  userAdminErrorMessage,
  userEditPayload,
  type PasswordResetPanelState,
  type UserEditState,
} from "../lib/users";

/** Client-side create-user validation; the server re-validates. */
function createUserValidation(values: {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}): { message: string; field: string } | null {
  if (values.firstName.trim() === "") {
    return { message: "Įveskite vardą.", field: "user-first-name" };
  }
  if (values.lastName.trim() === "") {
    return { message: "Įveskite pavardę.", field: "user-last-name" };
  }
  if (values.username.trim() === "") {
    return { message: "Įveskite naudotojo vardą.", field: "user-username" };
  }
  if (values.password.length === 0) {
    return { message: "Įveskite slaptažodį.", field: "user-password" };
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return { message: passwordTooShortMessage(), field: "user-password" };
  }
  return null;
}

/** User administration composition (rendered inside the ADMIN-only shell). */
export function UsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleKey>("WAREHOUSE_WORKER");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<UserEditState | null>(null);
  const [resetPanel, setResetPanel] = useState<PasswordResetPanelState>(
    CLOSED_PASSWORD_RESET_PANEL,
  );
  const router = useRouter();
  const { clearSession } = useAuth();
  const toast = useToast();

  /**
   * Surface an action error through the global toaster; on a 401 (expired/absent
   * session) clear client session state and return to the login screen. Known API
   * failures are mapped to specific Lithuanian messages; unknown ones fall back to
   * the caller's text.
   */
  function handleError(caught: unknown, fallback: string): void {
    if (isUnauthorized(caught)) {
      clearSession();
      router.replace("/login");
      return;
    }
    if (process.env.NODE_ENV === "development") {
      // Keep enough context to diagnose request failures locally.
      console.error("[Naudotojai]", caught);
    }
    toast.error(
      caught instanceof ApiError ? userAdminErrorMessage(caught) : fallback,
    );
  }

  const reload = useCallback(async (): Promise<void> => {
    try {
      setUsers(await apiFetch<UserSummary[]>("/users"));
      setLoadError(null);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setLoadError(
        caught instanceof ApiError
          ? userAdminErrorMessage(caught)
          : "Nepavyko įkelti naudotojų",
      );
    }
  }, [clearSession, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const issue = createUserValidation({
      firstName,
      lastName,
      username,
      password,
    });
    if (issue) {
      toast.error(issue.message);
      focusField(issue.field);
      return;
    }
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          roles: [role],
        }),
      });
      setUsername("");
      setFirstName("");
      setLastName("");
      setPassword("");
      toast.success("Naudotojas sukurtas.");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti naudotojo");
    }
  }

  function startEdit(user: UserSummary): void {
    setEditingId(user.id);
    setEdit({
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      active: user.active,
    });
    setResetPanel(CLOSED_PASSWORD_RESET_PANEL);
  }

  function closeEdit(): void {
    setEditingId(null);
    setEdit(null);
    setResetPanel(CLOSED_PASSWORD_RESET_PANEL);
  }

  /** `Uždaryti`: clear and close the reset section without touching the edit form. */
  function closePasswordReset(): void {
    setResetPanel(closePasswordResetPanel());
  }

  function toggleRole(roleKey: RoleKey): void {
    setEdit((current) => {
      if (!current) {
        return current;
      }
      return { ...current, roles: toggleRoleSelection(current.roles, roleKey) };
    });
  }

  async function saveEdit(): Promise<void> {
    if (!editingId || !edit) {
      return;
    }
    if (edit.roles.length === 0) {
      toast.error("Pasirinkite bent vieną vaidmenį.");
      focusField("user-edit-role-ADMIN");
      return;
    }
    try {
      const updated = await apiFetch<UserSummary>(`/users/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(userEditPayload(edit)),
      });
      setUsers((current) => applyUserUpdate(current, updated));
      setEditingId(null);
      setEdit(null);
      toast.success("Naudotojas atnaujintas.");
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti naudotojo");
    }
  }

  async function toggleActive(user: UserSummary): Promise<void> {
    try {
      const updated = await apiFetch<UserSummary>(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      setUsers((current) => applyUserUpdate(current, updated));
      toast.success("Naudotojo būsena atnaujinta.");
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti naudotojo");
    }
  }

  async function submitPasswordReset(): Promise<void> {
    if (!editingId) {
      return;
    }
    const validation = passwordResetError(resetPanel.form);
    if (validation) {
      toast.error(validation);
      focusField(
        resetPanel.form.password.length === 0
          ? "user-reset-password"
          : "user-reset-confirm",
      );
      return;
    }
    try {
      await apiFetch<UserSummary>(`/users/${editingId}/password`, {
        method: "PATCH",
        body: JSON.stringify(passwordResetPayload(resetPanel.form)),
      });
      setResetPanel(CLOSED_PASSWORD_RESET_PANEL);
      toast.success("Slaptažodis pakeistas.");
      await reload();
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      toast.error(passwordResetErrorMessage(caught));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Naudotojai</h1>
      <SectionTabs />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <section className={workSurfaceClass()}>
        <h2 className="text-lg font-medium">Sukurti naudotoją</h2>
        <form onSubmit={onCreate} noValidate className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            id="user-first-name"
            required
            placeholder="Vardas"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            id="user-last-name"
            required
            placeholder="Pavardė"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            id="user-username"
            required
            placeholder="Naudotojo vardas"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            id="user-password"
            required
            type="password"
            placeholder="Slaptažodis (bent 6 simboliai)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            id="user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as RoleKey)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ROLE_KEYS.map((key) => (
              <option key={key} value={key}>
                {ROLE_LABELS[key]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Sukurti
          </button>
        </form>
      </section>

      {editingId && edit ? (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Redaguoti naudotoją</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              id="user-edit-first-name"
              placeholder="Vardas"
              value={edit.firstName}
              onChange={(event) =>
                setEdit({ ...edit, firstName: event.target.value })
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              id="user-edit-last-name"
              placeholder="Pavardė"
              value={edit.lastName}
              onChange={(event) =>
                setEdit({ ...edit, lastName: event.target.value })
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <fieldset className="mt-3 flex flex-wrap gap-4">
            <legend className="sr-only">Vaidmenys</legend>
            {ROLE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  id={`user-edit-role-${key}`}
                  type="checkbox"
                  checked={edit.roles.includes(key)}
                  disabled={isRoleControlDisabled(key, edit.roles)}
                  onChange={() => toggleRole(key)}
                />
                {ROLE_LABELS[key]}
              </label>
            ))}
          </fieldset>
          <p className="mt-2 text-xs text-muted-foreground">
            Administratorius turi visas teises, todėl kiti vaidmenys nereikalingi.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={edit.active}
              onChange={(event) =>
                setEdit({ ...edit, active: event.target.checked })
              }
            />
            Aktyvus
          </label>

          <div className="mt-4 border-t border-border pt-4">
            {resetPanel.open ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">
                  Nustatyti naują slaptažodį
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PasswordInput
                    id="user-reset-password"
                    autoComplete="new-password"
                    placeholder="Naujas slaptažodis"
                    value={resetPanel.form.password}
                    onChange={(value) =>
                      setResetPanel((current) => ({
                        ...current,
                        form: { ...current.form, password: value },
                      }))
                    }
                  />
                  <PasswordInput
                    id="user-reset-confirm"
                    autoComplete="new-password"
                    placeholder="Pakartoti slaptažodį"
                    value={resetPanel.form.confirm}
                    onChange={(value) =>
                      setResetPanel((current) => ({
                        ...current,
                        form: { ...current.form, confirm: value },
                      }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void submitPasswordReset()}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Pakeisti slaptažodį
                  </button>
                  <button
                    type="button"
                    onClick={closePasswordReset}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    Uždaryti
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setResetPanel(openPasswordResetPanel())}
                  className="self-start rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  Nustatyti naują slaptažodį
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => void saveEdit()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Išsaugoti
            </button>
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              Atšaukti
            </button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Vardas, pavardė</th>
              <th className="px-4 py-2 font-medium">Naudotojo vardas</th>
              <th className="px-4 py-2 font-medium">Vaidmenys</th>
              <th className="px-4 py-2 font-medium">Būsena</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className={`border-t border-border ${inactiveRowClass(user.active)}`}
              >
                <td className="px-4 py-2">
                  {user.firstName} {user.lastName}
                </td>
                <td className="px-4 py-2 font-mono">{user.username}</td>
                <td className="px-4 py-2">{userRolesSummary(user.roles)}</td>
                <td className="px-4 py-2">
                  {user.active ? "Aktyvus" : "Neaktyvus"}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(user)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      Redaguoti
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleActive(user)}
                      className={toggleActionClass(user.active)}
                    >
                      {activeToggleLabel(user.active)}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
