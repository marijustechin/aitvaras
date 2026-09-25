"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  WarehouseLocation,
  WarehouseWithLocations,
} from "@aitvaras/contracts";
import { EMPTY_LOCATIONS_MESSAGE } from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel } from "@/shared/lib/format";
import { inactiveRowClass, toggleActionClass } from "@/shared/lib/row-styles";
import { workSurfaceClass } from "@/shared/lib/surfaces";

/** Warehouse detail: rename/activate the warehouse and manage its locations. */
export function WarehouseDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const [warehouse, setWarehouse] = useState<WarehouseWithLocations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState("");

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  const handleError = useCallback(
    (caught: unknown, fallback: string): void => {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setError("Sandėlis nerastas.");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router],
  );

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await apiFetch<WarehouseWithLocations>(`/warehouses/${id}`);
      setWarehouse(data);
      setNameDraft(data.name);
      setError(null);
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti sandėlio");
    } finally {
      setLoading(false);
    }
  }, [handleError, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function renameWarehouse(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (nameDraft.trim() === "") {
      setError("Įveskite sandėlio pavadinimą.");
      return;
    }
    setError(null);
    try {
      const updated = await apiFetch<WarehouseWithLocations>(`/warehouses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nameDraft.trim() }),
      });
      setWarehouse(updated);
      setNameDraft(updated.name);
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti sandėlio");
    }
  }

  async function toggleWarehouseActive(): Promise<void> {
    if (!warehouse) {
      return;
    }
    setError(null);
    try {
      const updated = await apiFetch<WarehouseWithLocations>(`/warehouses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !warehouse.active }),
      });
      setWarehouse(updated);
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti sandėlio");
    }
  }

  async function addLocation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (newLocationName.trim() === "") {
      setError("Įveskite vietos pavadinimą.");
      return;
    }
    setError(null);
    try {
      await apiFetch<WarehouseLocation>(`/warehouses/${id}/locations`, {
        method: "POST",
        body: JSON.stringify({ name: newLocationName.trim() }),
      });
      setNewLocationName("");
      await load();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti vietos");
    }
  }

  async function saveLocation(locationId: string): Promise<void> {
    if (editLocationName.trim() === "") {
      setError("Įveskite vietos pavadinimą.");
      return;
    }
    setError(null);
    try {
      await apiFetch(`/warehouses/${id}/locations/${locationId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editLocationName.trim() }),
      });
      setEditingLocationId(null);
      setEditLocationName("");
      await load();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti vietos");
    }
  }

  async function toggleLocationActive(location: WarehouseLocation): Promise<void> {
    setError(null);
    try {
      await apiFetch(`/warehouses/${id}/locations/${location.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !location.active }),
      });
      await load();
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti vietos");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (error && !warehouse) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Link href="/warehouses" className="text-sm hover:underline">
          ← Sandėliai
        </Link>
      </div>
    );
  }

  if (!warehouse) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {warehouse.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Būsena: {activeStatusLabel(warehouse.active)}
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => void toggleWarehouseActive()}
            className={toggleActionClass(warehouse.active, "detail")}
          >
            {warehouse.active ? "Išjungti" : "Įjungti"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Redaguoti sandėlį</h2>
          <form onSubmit={renameWarehouse} className="mt-4 flex flex-wrap gap-3">
            <input
              required
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Išsaugoti
            </button>
          </form>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Sandėlio vietos</h2>

        {isAdmin ? (
          <form onSubmit={addLocation} className="flex flex-wrap gap-3">
            <input
              required
              placeholder="Vietos pavadinimas"
              value={newLocationName}
              onChange={(event) => setNewLocationName(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Pridėti vietą
            </button>
          </form>
        ) : null}

        {warehouse.locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_LOCATIONS_MESSAGE}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Pavadinimas</th>
                  <th className="px-4 py-2 font-medium">Būsena</th>
                  {isAdmin ? <th className="px-4 py-2 font-medium" /> : null}
                </tr>
              </thead>
              <tbody>
                {warehouse.locations.map((location) => (
                  <tr
                    key={location.id}
                    className={`border-t border-border ${inactiveRowClass(location.active)}`}
                  >
                    <td className="px-4 py-2">
                      {editingLocationId === location.id ? (
                        <input
                          value={editLocationName}
                          onChange={(event) => setEditLocationName(event.target.value)}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                      ) : (
                        location.name
                      )}
                    </td>
                    <td className="px-4 py-2">{activeStatusLabel(location.active)}</td>
                    {isAdmin ? (
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {editingLocationId === location.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveLocation(location.id)}
                                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                              >
                                Išsaugoti
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingLocationId(null);
                                  setEditLocationName("");
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
                                  setEditingLocationId(location.id);
                                  setEditLocationName(location.name);
                                }}
                                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                              >
                                Redaguoti
                              </button>
                              <button
                                type="button"
                                onClick={() => void toggleLocationActive(location)}
                                className={toggleActionClass(location.active)}
                              >
                                {location.active ? "Išjungti" : "Įjungti"}
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
          </div>
        )}
      </section>

      <Link href="/warehouses" className="text-sm hover:underline">
        ← Sandėliai
      </Link>
    </div>
  );
}
