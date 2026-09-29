"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BATCH_STATUSES,
  type Batch,
  type BatchStatus,
  type Partner,
  type Resource,
  type WarehouseWithLocations,
} from "@aitvaras/contracts";
import {
  batchStatusLabel,
  EMPTY_BATCHES_MESSAGE,
  formatArrivalDate,
  formatWeight,
} from "@/entities/batch";
import { activeSuppliers } from "@/entities/partner";
import { activeResources } from "@/entities/resource";
import { activeWarehouses } from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  batchFormError,
  createDraftBatch,
  toCreateBatchPayload,
  type DraftBatch,
} from "../lib/batch-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const CREATOR_ROLES = ["ADMIN", "WAREHOUSE_WORKER"] as const;

/** Partijos: start a batch and review existing batches. */
export function BatchesPage() {
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[] | null>(
    null,
  );
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | BatchStatus>("");
  const [draft, setDraft] = useState<DraftBatch>(createDraftBatch);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canCreate = Boolean(
    user && CREATOR_ROLES.some((role) => user.roles.includes(role)),
  );

  const handleError = useCallback(
    (caught: unknown, fallback: string): void => {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router],
  );

  const reloadBatches = useCallback(
    async (status: "" | BatchStatus): Promise<void> => {
      try {
        const query = status ? `?status=${status}` : "";
        setBatches(await apiFetch<Batch[]>(`/batches${query}`));
      } catch (caught) {
        handleError(caught, "Nepavyko įkelti partijų");
      }
    },
    [handleError],
  );

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const [partnerList, resourceList, warehouseList, batchList] =
          await Promise.all([
            apiFetch<Partner[]>("/partners"),
            apiFetch<Resource[]>("/resources"),
            apiFetch<WarehouseWithLocations[]>("/warehouses"),
            apiFetch<Batch[]>("/batches"),
          ]);
        if (!active) {
          return;
        }
        setPartners(partnerList);
        setResources(resourceList);
        setWarehouses(warehouseList);
        setBatches(batchList);
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti partijų duomenų");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [handleError]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = batchFormError(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<Batch>("/batches", {
        method: "POST",
        body: JSON.stringify(toCreateBatchPayload(draft)),
      });
      setDraft(createDraftBatch());
      router.push(`/receipts/batches/${created.id}`);
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti partijos");
    } finally {
      setSubmitting(false);
    }
  }

  const supplierOptions = partners ? activeSuppliers(partners) : [];
  const resourceOptions = resources ? activeResources(resources) : [];
  const warehouseOptions = warehouses ? activeWarehouses(warehouses) : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/receipts" className="text-sm hover:underline">
          ← Pajamavimas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Partijos</h1>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {canCreate ? (
        <section className={workSurfaceClass()}>
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Išteklius</span>
              <select
                required
                value={draft.resourceId}
                onChange={(event) =>
                  setDraft({ ...draft, resourceId: event.target.value })
                }
                className={inputClass}
              >
                <option value="">— Pasirinkti —</option>
                {resourceOptions.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Tiekėjas</span>
              <select
                required
                value={draft.supplierId}
                onChange={(event) =>
                  setDraft({ ...draft, supplierId: event.target.value })
                }
                className={inputClass}
              >
                <option value="">— Pasirinkti —</option>
                {supplierOptions.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Sandėlis</span>
              <select
                required
                value={draft.warehouseId}
                onChange={(event) =>
                  setDraft({ ...draft, warehouseId: event.target.value })
                }
                className={inputClass}
              >
                <option value="">— Pasirinkti —</option>
                {warehouseOptions.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm sm:max-w-xs">
              <span className="font-medium">Priėmimo data</span>
              <input
                required
                type="date"
                value={draft.arrivalDate}
                onChange={(event) =>
                  setDraft({ ...draft, arrivalDate: event.target.value })
                }
                className={inputClass}
              />
            </label>

            <div className="flex items-center justify-end border-t border-border pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {submitting ? "Kuriama…" : "Pradėti partiją"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Partijų sąrašas</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Būsena</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                const value = event.target.value as "" | BatchStatus;
                setStatusFilter(value);
                void reloadBatches(value);
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Visos</option>
              {BATCH_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {batchStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {batches === null ? (
          <p className="text-sm text-muted-foreground">Kraunama…</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_BATCHES_MESSAGE}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Kodas</th>
                  <th className="px-4 py-2 font-medium">Priėmimo data</th>
                  <th className="px-4 py-2 font-medium">Išteklius</th>
                  <th className="px-4 py-2 font-medium">Tiekėjas</th>
                  <th className="px-4 py-2 font-medium">Sandėlis</th>
                  <th className="px-4 py-2 font-medium">Būsena</th>
                  <th className="px-4 py-2 font-medium">Maišai</th>
                  <th className="px-4 py-2 font-medium">Svoris</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link
                        href={`/receipts/batches/${batch.id}`}
                        className="font-medium hover:underline"
                      >
                        {batch.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {formatArrivalDate(batch.arrivalDate)}
                    </td>
                    <td className="px-4 py-2">{batch.resourceName}</td>
                    <td className="px-4 py-2">{batch.supplierName}</td>
                    <td className="px-4 py-2">{batch.warehouseName}</td>
                    <td className="px-4 py-2">{batchStatusLabel(batch.status)}</td>
                    <td className="px-4 py-2">{batch.bagCount}</td>
                    <td className="px-4 py-2">{formatWeight(batch.totalWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
