"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Batch, IncomingDelivery } from "@aitvaras/contracts";
import {
  canReceiveStock,
  formatArrivalDate,
} from "@/entities/batch";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import {
  buttonClass,
  DateInput,
  PlusIcon,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_NAV_BUTTON_CLASS,
  useToast,
} from "@/shared/ui";
import {
  BATCH_STATUS_FILTERS,
  BATCH_STATUS_FILTER_LABELS,
  BATCH_LIST_FILTERS_STORAGE_KEY,
  confirmedBatchesLabel,
  createBatchListFilters,
  DELETE_RECEIPT_CANCEL_LABEL,
  DELETE_RECEIPT_CONFIRM_LABEL,
  DELETE_RECEIPT_LABEL,
  EMPTY_GAVIMAI_MESSAGE,
  EMPTY_RECEIPT_EXPENSE_BLOCK_MESSAGE,
  GAVIMAI_HEADING,
  hasActiveBatchFilters,
  paginateReceiptRows,
  parseBatchListFilters,
  receiptRows,
  receiptStatusClass,
  receiptStatusLabel,
  RECEIPT_PAGE_SIZE,
  RESET_FILTERS_LABEL,
  resourceFilterOptions,
  supplierFilterOptionsWithReceipts,
  warehouseFilterOptions,
  type BatchListFilters,
  type FilterOption,
} from "../lib/batch-list";

const filterInputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * `Priėmimas` — the single receipt list (`Priėmimai`).
 *
 * One row per receipt, even when it contains several batches. Batch-specific
 * filters match a receipt once; pagination runs after the receipt grouping.
 */
export function GavimaiPage() {
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const toast = useToast();
  const canStartReceipt = user ? canReceiveStock(user.roles) : false;
  const canConfirm = user?.roles.includes("ADMIN") ?? false;

  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [deliveries, setDeliveries] = useState<IncomingDelivery[] | null>(null);
  const [filters, setFilters] = useState<BatchListFilters>(createBatchListFilters);
  const [filtersRestored, setFiltersRestored] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<IncomingDelivery | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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
        const [batchList, deliveryList] = await Promise.all([
          apiFetch<Batch[]>("/batches"),
          apiFetch<IncomingDelivery[]>("/deliveries"),
        ]);
        if (!active) {
          return;
        }
        setBatches(batchList);
        setDeliveries(deliveryList);
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti priėmimų");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [handleError, reloadToken]);

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

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const all = batches ?? [];
  const allDeliveries = deliveries ?? [];
  const grouped = receiptRows(all, allDeliveries, filters);
  const pageState = paginateReceiptRows(grouped, page, RECEIPT_PAGE_SIZE);
  const supplierOptions = supplierFilterOptionsWithReceipts(all, allDeliveries);
  const resourceOptions = resourceFilterOptions(all);
  const warehouseOptions = warehouseFilterOptions(all);

  function update(patch: Partial<BatchListFilters>): void {
    setFilters((current) => ({ ...current, ...patch }));
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await apiFetch<void>(`/deliveries/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success(`Priėmimas ${deleteTarget.code} ištrintas.`);
      setDeleteTarget(null);
      setReloadToken((current) => current + 1);
    } catch (caught) {
      setDeleteTarget(null);
      handleError(caught, "Nepavyko ištrinti priėmimo");
      setReloadToken((current) => current + 1);
    } finally {
      setDeleting(false);
    }
  }

  function optionList(
    id: string,
    label: string,
    value: string,
    options: FilterOption[],
    onChange: (value: string) => void,
  ) {
    return (
      <label className="grid gap-1 text-sm">
        <span className="font-medium">{label}</span>
        <select
          id={id}
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

      <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Būsena</span>
          <select
            id="filter-status"
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
        {optionList(
          "filter-supplier",
          "Tiekėjas",
          filters.supplierId,
          supplierOptions,
          (value) => update({ supplierId: value }),
        )}
        {optionList(
          "filter-resource",
          "Išteklius",
          filters.resourceId,
          resourceOptions,
          (value) => update({ resourceId: value }),
        )}
        {optionList(
          "filter-warehouse",
          "Sandėlis",
          filters.warehouseId,
          warehouseOptions,
          (value) => update({ warehouseId: value }),
        )}
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Priėmimo data nuo</span>
          <DateInput
            id="filter-arrival-from"
            value={filters.arrivalFrom}
            onChange={(arrivalFrom) => update({ arrivalFrom })}
            className={filterInputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Priėmimo data iki</span>
          <DateInput
            id="filter-arrival-to"
            value={filters.arrivalTo}
            onChange={(arrivalTo) => update({ arrivalTo })}
            className={filterInputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Partijos kodas</span>
          <input
            id="filter-code"
            type="search"
            value={filters.code}
            onChange={(event) => update({ code: event.target.value })}
            placeholder="P01"
            className={filterInputClass}
          />
        </label>
        {hasActiveBatchFilters(filters) ? (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters(createBatchListFilters())}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              {RESET_FILTERS_LABEL}
            </button>
          </div>
        ) : null}
      </section>

      {batches === null || deliveries === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_GAVIMAI_MESSAGE}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Priėmimas</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Priėmimo data
                </th>
                <th className="px-4 py-2 font-medium">Tiekėjas</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Patvirtintos partijos
                </th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Būsena</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {pageState.rows.map((row) => (
                <tr
                  key={row.delivery.id}
                  className="border-t border-border transition-colors hover:bg-accent/50"
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    <Link
                      href={`/receiving/${row.delivery.id}`}
                      aria-label={`Atidaryti priėmimą ${row.delivery.code}`}
                      className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row.delivery.code}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatArrivalDate(row.delivery.arrivalDate)}
                  </td>
                  <td className="px-4 py-2">{row.delivery.supplierName}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {confirmedBatchesLabel(row)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className={receiptStatusClass(row.status)}>
                      {receiptStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.status === "NO_BATCHES" ? (
                      canStartReceipt ? (
                        row.delivery.hasNonZeroExpenses ? (
                          <span className="text-xs text-muted-foreground">
                            {EMPTY_RECEIPT_EXPENSE_BLOCK_MESSAGE}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(row.delivery)}
                            className={buttonClass("destructive", "sm")}
                          >
                            {DELETE_RECEIPT_LABEL}
                          </button>
                        )
                      ) : null
                    ) : row.status === "PENDING" ? (
                      canConfirm ? (
                        <Link
                          href={`/receipts/${row.delivery.id}`}
                          className={SECONDARY_NAV_BUTTON_CLASS}
                        >
                          Tvirtinti
                        </Link>
                      ) : null
                    ) : canConfirm ? (
                      <Link
                        href={`/receipts/${row.delivery.id}`}
                        className={SECONDARY_NAV_BUTTON_CLASS}
                      >
                        Peržiūrėti
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grouped.length > RECEIPT_PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Rodoma {pageState.from}–{pageState.to} iš {pageState.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pageState.page <= 1}
              className={SECONDARY_NAV_BUTTON_CLASS}
            >
              Ankstesnis
            </button>
            <span>
              {pageState.page} / {pageState.totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  Math.min(pageState.totalPages, current + 1),
                )
              }
              disabled={pageState.page >= pageState.totalPages}
              className={SECONDARY_NAV_BUTTON_CLASS}
            >
              Kitas
            </button>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-receipt-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 id="delete-receipt-title" className="text-lg font-medium">
              {DELETE_RECEIPT_LABEL} {deleteTarget.code}?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Priėmimas bus ištrintas negrįžtamai. Šis veiksmas taikomas tik
              priėmimui be partijų ir be užregistruotų išlaidų.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className={SECONDARY_NAV_BUTTON_CLASS}
              >
                {DELETE_RECEIPT_CANCEL_LABEL}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className={buttonClass("destructive")}
              >
                {deleting ? "Trinama…" : DELETE_RECEIPT_CONFIRM_LABEL}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
