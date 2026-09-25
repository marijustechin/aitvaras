"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WarehouseWithLocations } from "@aitvaras/contracts";
import { EMPTY_WAREHOUSES_MESSAGE } from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel } from "@/shared/lib/format";
import { inactiveRowClass } from "@/shared/lib/row-styles";
import { workSurfaceClass } from "@/shared/lib/surfaces";

/** Warehouses list (Sandėliai); ADMIN can create. */
export function WarehousesPage() {
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

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
      setWarehouses(await apiFetch<WarehouseWithLocations[]>("/warehouses"));
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti sandėlių");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (newName.trim() === "") {
      setError("Įveskite sandėlio pavadinimą.");
      return;
    }
    setError(null);
    try {
      await apiFetch("/warehouses", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await reload();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti sandėlio");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sandėliai</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Naujas sandėlis</h2>
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

      {warehouses === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : warehouses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_WAREHOUSES_MESSAGE}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Pavadinimas</th>
                <th className="px-4 py-2 font-medium">Vietų skaičius</th>
                <th className="px-4 py-2 font-medium">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr
                  key={warehouse.id}
                  className={`border-t border-border ${inactiveRowClass(warehouse.active)}`}
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/warehouses/${warehouse.id}`}
                      className="font-medium hover:underline"
                    >
                      {warehouse.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{warehouse.locations.length}</td>
                  <td className="px-4 py-2">{activeStatusLabel(warehouse.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
