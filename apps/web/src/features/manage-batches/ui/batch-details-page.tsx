"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  Bag,
  BatchDetail,
  WarehouseWithLocations,
} from "@aitvaras/contracts";
import {
  bagLocationLabel,
  batchStatusLabel,
  EMPTY_BAGS_MESSAGE,
  formatArrivalDate,
  formatBatchDateTime,
  formatWeight,
  isBatchOpen,
} from "@/entities/batch";
import { locationsForWarehouse } from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  bagFormError,
  createDraftBag,
  toCreateBagPayload,
  type DraftBag,
} from "../lib/batch-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const CREATOR_ROLES = ["ADMIN", "WAREHOUSE_WORKER"] as const;

function Label({ batch, bag }: { batch: BatchDetail; bag: Bag }) {
  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Etiketė
      </p>
      <p className="mt-2 text-lg font-semibold">{batch.resourceName}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Partija</dt>
        <dd className="font-medium">{batch.code}</dd>
        <dt className="text-muted-foreground">Svoris</dt>
        <dd>{formatWeight(bag.weight)}</dd>
        <dt className="text-muted-foreground">Priėmimo data</dt>
        <dd>{formatArrivalDate(batch.arrivalDate)}</dd>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">Brūkšninis kodas</p>
      <p className="font-mono text-base tracking-widest">{bag.barcode}</p>
    </div>
  );
}

/** Batch (partija) detail: register bags and preview/print labels. */
export function BatchDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftBag, setDraftBag] = useState<DraftBag>(createDraftBag);
  const [labelBag, setLabelBag] = useState<Bag | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      if (caught instanceof ApiError && caught.status === 404) {
        setError("Partija nerasta.");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router],
  );

  const loadBatch = useCallback(async (): Promise<void> => {
    setBatch(await apiFetch<BatchDetail>(`/batches/${id}`));
  }, [id]);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      try {
        const [batchResult, warehouseList] = await Promise.all([
          apiFetch<BatchDetail>(`/batches/${id}`),
          apiFetch<WarehouseWithLocations[]>("/warehouses"),
        ]);
        if (!active) {
          return;
        }
        setBatch(batchResult);
        setWarehouses(warehouseList);
        setError(null);
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti partijos");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [handleError, id]);

  async function submitBag(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const validation = bagFormError(draftBag);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const created = await apiFetch<Bag>(`/batches/${id}/bags`, {
        method: "POST",
        body: JSON.stringify(toCreateBagPayload(draftBag)),
      });
      setDraftBag(createDraftBag());
      setLabelBag(created);
      setNotice(`Maišas pridėtas: ${created.barcode}`);
      await loadBatch();
    } catch (caught) {
      handleError(caught, "Nepavyko pridėti maišo");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (error && !batch) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Link href="/receipts/batches" className="text-sm hover:underline">
          ← Partijos
        </Link>
      </div>
    );
  }

  if (!batch) {
    return <p className="text-sm text-muted-foreground">Partija nerasta.</p>;
  }

  const open = isBatchOpen(batch.status);
  const locationOptions = warehouses
    ? locationsForWarehouse(warehouses, batch.warehouseId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/receipts/batches" className="text-sm hover:underline">
          ← Partijos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Partija {batch.code}
        </h1>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <section className={workSurfaceClass()}>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium">Būsena</dt>
            <dd className="text-sm text-muted-foreground">
              {batchStatusLabel(batch.status)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Priėmimo data</dt>
            <dd className="text-sm text-muted-foreground">
              {formatArrivalDate(batch.arrivalDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Išteklius</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.resourceName}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Tiekėjas</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.supplierName}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Sandėlis</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.warehouseName}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Maišai / svoris</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.bagCount} · {formatWeight(batch.totalWeight)}
            </dd>
          </div>
        </dl>
      </section>

      {canCreate && open ? (
        <section className={workSurfaceClass()}>
          <form onSubmit={submitBag} className="grid gap-4">
            <h2 className="text-lg font-medium">Pridėti maišą</h2>
            <div className="grid gap-3 sm:grid-cols-12">
              <label className="grid gap-1 text-sm sm:col-span-3">
                <span className="font-medium">Svoris (kg)</span>
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  value={draftBag.weight}
                  onChange={(event) =>
                    setDraftBag({ ...draftBag, weight: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-5">
                <span className="font-medium">Vieta</span>
                <select
                  value={draftBag.warehouseLocationId}
                  onChange={(event) =>
                    setDraftBag({
                      ...draftBag,
                      warehouseLocationId: event.target.value,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">— Be konkrečios vietos —</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end sm:col-span-4">
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {adding ? "Pridedama…" : "Pridėti maišą"}
                </button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Maišai</h2>
        {batch.bags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_BAGS_MESSAGE}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Brūkšninis kodas</th>
                  <th className="px-4 py-2 font-medium">Svoris</th>
                  <th className="px-4 py-2 font-medium">Vieta</th>
                  <th className="px-4 py-2 font-medium">Pridėta</th>
                  <th className="px-4 py-2 font-medium">Etiketė</th>
                </tr>
              </thead>
              <tbody>
                {batch.bags.map((bag) => (
                  <tr key={bag.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono">{bag.barcode}</td>
                    <td className="px-4 py-2">{formatWeight(bag.weight)}</td>
                    <td className="px-4 py-2">
                      {bagLocationLabel(bag.warehouseLocationName)}
                    </td>
                    <td className="px-4 py-2">
                      {formatBatchDateTime(bag.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setLabelBag(bag)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Etiketė
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {labelBag ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Etiketės peržiūra</h2>
          <Label batch={batch} bag={labelBag} />
          <div>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Spausdinti
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
