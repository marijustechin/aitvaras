"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PackingForm } from "@aitvaras/contracts";
import { EMPTY_PACKING_FORMS_MESSAGE } from "@/entities/packing-form";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel } from "@/shared/lib/format";
import { inactiveRowClass, toggleActionClass } from "@/shared/lib/row-styles";
import { workSurfaceClass } from "@/shared/lib/surfaces";

/** Packing-form reference-data administration (rendered inside the shell). */
export function PackingFormsPage() {
  const { user, clearSession } = useAuth();
  const router = useRouter();
  const [forms, setForms] = useState<PackingForm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  function handleError(caught: unknown, fallback: string): void {
    if (isUnauthorized(caught)) {
      clearSession();
      router.replace("/login");
      return;
    }
    setError(caught instanceof ApiError ? caught.message : fallback);
  }

  const reload = useCallback(async (): Promise<void> => {
    try {
      setForms(await apiFetch<PackingForm[]>("/packing-forms"));
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti pakavimo formų");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (newName.trim() === "") {
      setError("Įveskite pakavimo formos pavadinimą.");
      return;
    }
    setError(null);
    try {
      await apiFetch("/packing-forms", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti pakavimo formos");
    }
  }

  async function saveEdit(id: string): Promise<void> {
    if (editName.trim() === "") {
      setError("Įveskite pakavimo formos pavadinimą.");
      return;
    }
    setError(null);
    try {
      await apiFetch(`/packing-forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditingId(null);
      setEditName("");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti pakavimo formos");
    }
  }

  async function toggleActive(form: PackingForm): Promise<void> {
    setError(null);
    try {
      await apiFetch(`/packing-forms/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !form.active }),
      });
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti pakavimo formos");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pakavimo formos</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Nauja pakavimo forma</h2>
          <form onSubmit={onCreate} className="mt-4 flex flex-wrap gap-3">
            <input
              required
              placeholder="Pavadinimas"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Sukurti
            </button>
          </form>
        </section>
      ) : null}

      {forms === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : forms.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_PACKING_FORMS_MESSAGE}</p>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Pavadinimas</th>
                <th className="px-4 py-2 font-medium">Būsena</th>
                {isAdmin ? <th className="px-4 py-2 font-medium" /> : null}
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr
                  key={form.id}
                  className={`border-t border-border ${inactiveRowClass(form.active)}`}
                >
                  <td className="px-4 py-2">
                    {editingId === form.id ? (
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      form.name
                    )}
                  </td>
                  <td className="px-4 py-2">{activeStatusLabel(form.active)}</td>
                  {isAdmin ? (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === form.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveEdit(form.id)}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Išsaugoti
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                              }}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Atšaukti
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(form.id);
                                setEditName(form.name);
                              }}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Redaguoti
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(form)}
                              className={toggleActionClass(form.active)}
                            >
                              {form.active ? "Išjungti" : "Įjungti"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Link href="/resources" className="text-sm hover:underline">
        ← Ištekliai
      </Link>
    </div>
  );
}
