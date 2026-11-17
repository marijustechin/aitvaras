"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PackagingType } from "@aitvaras/contracts";
import { formatWeight } from "@/entities/batch";
import { EMPTY_PACKAGING_TYPES_MESSAGE } from "@/entities/packaging-type";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel } from "@/shared/lib/format";
import { inactiveRowClass, toggleActionClass } from "@/shared/lib/row-styles";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { focusField } from "@/shared/lib/form-feedback";
import { SectionTabs, useToast } from "@/shared/ui";
import {
  packagingTypeFormError,
  toCreatePackagingTypePayload,
  toUpdatePackagingTypePayload,
} from "../lib/packaging-type-form";

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Packaging / tare (`Tara`) administration — ADMIN-managed master data.
 * Consistent with the other master-data pages: list, create, edit name/tare and
 * activate/deactivate; no hard delete (historical packages keep references).
 */
export function PackagingTypesPage() {
  const { user, clearSession } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [types, setTypes] = useState<PackagingType[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newTare, setNewTare] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTare, setEditTare] = useState("");

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  function handleError(caught: unknown, fallback: string): void {
    if (isUnauthorized(caught)) {
      clearSession();
      router.replace("/login");
      return;
    }
    toast.error(caught instanceof ApiError ? caught.message : fallback);
  }

  const reload = useCallback(async (): Promise<void> => {
    try {
      setTypes(await apiFetch<PackagingType[]>("/packaging-types"));
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti taros");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const draft = { name: newName, tareWeightKg: newTare };
    const validation = packagingTypeFormError(draft);
    if (validation) {
      toast.error(validation);
      focusField(newName.trim() === "" ? "packaging-new-name" : "packaging-new-tare");
      return;
    }
    try {
      await apiFetch("/packaging-types", {
        method: "POST",
        body: JSON.stringify(toCreatePackagingTypePayload(draft)),
      });
      setNewName("");
      setNewTare("");
      toast.success("Tara sukurta.");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti taros");
    }
  }

  async function saveEdit(id: string): Promise<void> {
    const draft = { name: editName, tareWeightKg: editTare };
    const validation = packagingTypeFormError(draft);
    if (validation) {
      toast.error(validation);
      focusField(editName.trim() === "" ? "packaging-edit-name" : "packaging-edit-tare");
      return;
    }
    try {
      await apiFetch(`/packaging-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(toUpdatePackagingTypePayload(draft)),
      });
      setEditingId(null);
      setEditName("");
      setEditTare("");
      toast.success("Tara atnaujinta.");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti taros");
    }
  }

  async function toggleActive(type: PackagingType): Promise<void> {
    try {
      await apiFetch(`/packaging-types/${type.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !type.active }),
      });
      toast.success("Taros būsena atnaujinta.");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti taros");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Tara</h1>
      <SectionTabs />

      {isAdmin ? (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Nauja tara</h2>
          <form onSubmit={onCreate} className="mt-4 flex flex-wrap gap-3">
            <input
              id="packaging-new-name"
              required
              placeholder="Pavadinimas"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className={inputClass}
            />
            <input
              id="packaging-new-tare"
              required
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              placeholder="Taros svoris, kg"
              value={newTare}
              onChange={(event) => setNewTare(event.target.value)}
              className={inputClass}
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

      {types === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : types.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {EMPTY_PACKAGING_TYPES_MESSAGE}
        </p>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Pavadinimas</th>
                <th className="px-4 py-2 font-medium">Taros svoris</th>
                <th className="px-4 py-2 font-medium">Būsena</th>
                {isAdmin ? <th className="px-4 py-2 font-medium" /> : null}
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr
                  key={type.id}
                  className={`border-t border-border ${inactiveRowClass(type.active)}`}
                >
                  <td className="px-4 py-2">
                    {editingId === type.id ? (
                      <input
                        id="packaging-edit-name"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      type.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === type.id ? (
                      <input
                        id="packaging-edit-tare"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.001"
                        value={editTare}
                        onChange={(event) => setEditTare(event.target.value)}
                        className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      formatWeight(type.tareWeightKg)
                    )}
                  </td>
                  <td className="px-4 py-2">{activeStatusLabel(type.active)}</td>
                  {isAdmin ? (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === type.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void saveEdit(type.id)}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Išsaugoti
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                                setEditTare("");
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
                                setEditingId(type.id);
                                setEditName(type.name);
                                setEditTare(type.tareWeightKg);
                              }}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              Redaguoti
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(type)}
                              className={toggleActionClass(type.active)}
                            >
                              {type.active ? "Išjungti" : "Įjungti"}
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
    </div>
  );
}
