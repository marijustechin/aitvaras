"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResourceCategory } from "@aitvaras/contracts";
import { EMPTY_RESOURCE_CATEGORIES_MESSAGE } from "@/entities/resource-category";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel } from "@/shared/lib/format";
import { inactiveRowClass, toggleActionClass } from "@/shared/lib/row-styles";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { SECONDARY_NAV_BUTTON_CLASS } from "@/shared/ui";
import {
  resourceCategoryFormError,
  resourceCategoryFormToPayload,
} from "../lib/resource-category-form";

/** Resource-category administration (rendered inside the shell). */
export function ResourceCategoriesPage() {
  const { user, clearSession } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<ResourceCategory[] | null>(null);
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
      setCategories(await apiFetch<ResourceCategory[]>("/resource-categories"));
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti kategorijų");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = resourceCategoryFormError({
      name: newName,
      active: true,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    try {
      await apiFetch("/resource-categories", {
        method: "POST",
        body: JSON.stringify(
          resourceCategoryFormToPayload({ name: newName, active: true }),
        ),
      });
      setNewName("");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti kategorijos");
    }
  }

  async function saveEdit(id: string): Promise<void> {
    const validation = resourceCategoryFormError({
      name: editName,
      active: true,
    });
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    try {
      await apiFetch(`/resource-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditingId(null);
      setEditName("");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti kategorijos");
    }
  }

  async function toggleActive(category: ResourceCategory): Promise<void> {
    setError(null);
    try {
      await apiFetch(`/resource-categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !category.active }),
      });
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti kategorijos");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kategorijos</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Nauja kategorija</h2>
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

      {categories === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {EMPTY_RESOURCE_CATEGORIES_MESSAGE}
        </p>
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
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className={`border-t border-border ${inactiveRowClass(category.active)}`}
                >
                  <td className="px-4 py-2">
                    {editingId === category.id ? (
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      category.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {activeStatusLabel(category.active)}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === category.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveEdit(category.id)}
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
                                setEditingId(category.id);
                                setEditName(category.name);
                              }}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Redaguoti
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(category)}
                              className={toggleActionClass(category.active)}
                            >
                              {category.active ? "Išjungti" : "Įjungti"}
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

      <Link href="/resources" className={SECONDARY_NAV_BUTTON_CLASS}>
        ← Ištekliai
      </Link>
    </div>
  );
}
