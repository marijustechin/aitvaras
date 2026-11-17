"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Batch } from "@aitvaras/contracts";
import {
  batchReceivingModeLabel,
  batchStatusLabel,
  canReceiveStock,
  formatArrivalDate,
  formatBatchDateTime,
  formatPieces,
  formatWeight,
} from "@/entities/batch";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { DateInput, PlusIcon, PRIMARY_BUTTON_CLASS, useToast } from "@/shared/ui";
import {
  BATCH_STATUS_FILTERS,
  BATCH_STATUS_FILTER_LABELS,
  BATCH_LIST_FILTERS_STORAGE_KEY,
  batchDetailHref,
  batchStatusClass,
  createBatchListFilters,
  EMPTY_GAVIMAI_MESSAGE,
  filterBatches,
  GAVIMAI_HEADING,
  hasActiveBatchFilters,
  parseBatchListFilters,
  RESET_FILTERS_LABEL,
  resourceFilterOptions,
  supplierFilterOptions,
  warehouseFilterOptions,
  type BatchListFilters,
  type FilterOption,
} from "../lib/batch-list";

const filterInputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * `Priėmimas` — the received-batch list and history (`Gautos partijos`).
 *
 * The batches here are the physical receipts created through the receiving
 * workflow; ADMIN confirms them here. The page opens on the `Reikia patvirtinti`
 * queue and links each row to the batch detail / formal reconciliation screen.
 * Filtering is client-side over the small received-batch dataset.
 */
export function GavimaiPage() {
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const toast = useToast();
  const canStartReceipt = user ? canReceiveStock(user.roles) : false;

  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [filters, setFilters] = useState<BatchListFilters>(createBatchListFilters);
  const [filtersRestored, setFiltersRestored] = useState(false);

  const handleError = useCallback(
    (caught: unknown, fallback: string): void => {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      toast.error(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router, toast],
  );

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const list = await apiFetch<Batch[]>("/batches");
        if (!active) {
          return;
        }
        setBatches(list);
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti gautų partijų");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [handleError]);

  useEffect(() => {
    try {
      setFilters(
        parseBatchListFilters(
          window.sessionStorage.getItem(BATCH_LIST_FILTERS_STORAGE_KEY),
        ),
      );
    } finally {
      setFiltersRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersRestored) {
      return;
    }
    window.sessionStorage.setItem(
      BATCH_LIST_FILTERS_STORAGE_KEY,
      JSON.stringify(filters),
    );
  }, [filters, filtersRestored]);

  const all = batches ?? [];
  const visible = filterBatches(all, filters);
  const supplierOptions = supplierFilterOptions(all);
  const resourceOptions = resourceFilterOptions(all);
  const warehouseOptions = warehouseFilterOptions(all);

  function update(patch: Partial<BatchListFilters>): void {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function optionList(
    label: string,
    value: string,
    options: FilterOption[],
    onChange: (value: string) => void,
  ) {
    return (
      <label className="grid gap-1 text-sm">
        <span className="font-medium">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={filterInputClass}
        >
          <option value="">Visi</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{GAVIMAI_HEADING}</h1>
        {canStartReceipt ? (
          <Link href="/receiving/new" className={PRIMARY_BUTTON_CLASS}>
            <PlusIcon />
            Naujas priėmimas
          </Link>
        ) : null}
      </div>

      <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Būsena</span>
          <select
            value={filters.status}
            onChange={(event) =>
              update({ status: event.target.value as BatchListFilters["status"] })
            }
            className={filterInputClass}
          >
            {BATCH_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {BATCH_STATUS_FILTER_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        {optionList("Tiekėjas", filters.supplierId, supplierOptions, (value) =>
          update({ supplierId: value }),
        )}
        {optionList("Išteklius", filters.resourceId, resourceOptions, (value) =>
          update({ resourceId: value }),
        )}
        {optionList("Sandėlis", filters.warehouseId, warehouseOptions, (value) =>
          update({ warehouseId: value }),
        )}
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Priėmimo data nuo</span>
          <DateInput
            value={filters.arrivalFrom}
            onChange={(arrivalFrom) => update({ arrivalFrom })}
            className={filterInputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Priėmimo data iki</span>
          <DateInput
            value={filters.arrivalTo}
            onChange={(arrivalTo) => update({ arrivalTo })}
            className={filterInputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Partijos kodas</span>
          <input
            type="search"
            value={filters.code}
            onChange={(event) => update({ code: event.target.value })}
            placeholder="P01"
            className={filterInputClass}
          />
        </label>
        <div className="flex items-end justify-start sm:col-span-2 lg:col-span-3">
          <button
            type="button"
            onClick={() => setFilters(createBatchListFilters())}
            disabled={!hasActiveBatchFilters(filters)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-60"
          >
            {RESET_FILTERS_LABEL}
          </button>
        </div>
      </section>

      {batches === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_GAVIMAI_MESSAGE}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Priėmimas</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Partija</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Priėmimo data
                </th>
                <th className="px-4 py-2 font-medium">Tiekėjas</th>
                <th className="px-4 py-2 font-medium">Tipas / turinys</th>
                <th className="px-4 py-2 font-medium">Sandėlis</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Kiekis
                </th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((batch) => (
                <tr
                  key={batch.id}
                  className="relative border-t border-border transition-colors hover:bg-accent/50 focus-within:bg-accent/50"
                >
                  <td className="whitespace-nowrap px-4 py-2">
                    {batch.deliveryCode}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    <Link
                      href={batchDetailHref(batch.id)}
                      aria-label={`Atidaryti partiją ${batch.code}`}
                      className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {batch.code}
                      <span aria-hidden="true" className="absolute inset-0" />
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatArrivalDate(batch.arrivalDate)}
                  </td>
                  <td className="px-4 py-2">{batch.supplierName}</td>
                  <td className="px-4 py-2">
                    {batch.receivingMode === "PIECE"
                      ? batchReceivingModeLabel(batch.receivingMode)
                      : batch.resourceName}
                  </td>
                  <td className="px-4 py-2">{batch.warehouseName}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {batch.receivingMode === "PIECE"
                      ? `${batch.itemLineCount} eil. · ${formatPieces(batch.totalPieces)}`
                      : `${batch.bagCount} · ${formatWeight(batch.totalNetWeight)}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className={batchStatusClass(batch.status)}>
                      {batchStatusLabel(batch.status)}
                    </span>
                    {batch.hasOpenDiscrepancy ? (
                      <span className="block text-xs text-rose-500">
                        Neatitikimas
                      </span>
                    ) : null}
                    {batch.status === "CONFIRMED" && batch.confirmedAt ? (
                      <span className="block text-xs text-muted-foreground">
                        {formatBatchDateTime(batch.confirmedAt)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
