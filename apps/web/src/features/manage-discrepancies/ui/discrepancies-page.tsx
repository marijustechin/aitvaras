"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReceivingDiscrepancyRegisterRow } from "@aitvaras/contracts";
import { formatBatchDateTime } from "@/entities/batch";
import {
  discrepancyDifferenceLabel,
  discrepancyDirectionClass,
  discrepancyDirectionLabel,
  discrepancyStatusClass,
  discrepancyStatusLabel,
  discrepancyWeightLabel,
  EMPTY_DISCREPANCIES_MESSAGE,
} from "@/entities/receiving-discrepancy";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { SECONDARY_NAV_BUTTON_CLASS } from "@/shared/ui";
import {
  createDiscrepancyListFilters,
  DISCREPANCIES_HEADING,
  DISCREPANCY_DIRECTION_FILTERS,
  DISCREPANCY_DIRECTION_FILTER_LABELS,
  DISCREPANCY_STATUS_FILTERS,
  DISCREPANCY_STATUS_FILTER_LABELS,
  discrepancyDetailHref,
  filterDiscrepancies,
  hasActiveDiscrepancyFilters,
  resourceFilterOptions,
  RESET_FILTERS_LABEL,
  supplierFilterOptions,
  type DiscrepancyFilterOption,
  type DiscrepancyListFilters,
} from "../lib/discrepancy-list";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** ADMIN discrepancy register (`Neatitikimai`): the long-lived mismatch ledger. */
export function DiscrepanciesPage() {
  const { clearSession } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ReceivingDiscrepancyRegisterRow[] | null>(
    null,
  );
  const [filters, setFilters] = useState<DiscrepancyListFilters>(
    createDiscrepancyListFilters,
  );
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setRows(
        await apiFetch<ReceivingDiscrepancyRegisterRow[]>(
          "/receiving-discrepancies",
        ),
      );
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Nepavyko įkelti neatitikimų",
      );
    }
  }, [clearSession, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function update(patch: Partial<DiscrepancyListFilters>): void {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function optionList(
    label: string,
    value: string,
    options: DiscrepancyFilterOption[],
    onChange: (value: string) => void,
  ) {
    return (
      <label className="grid gap-1 text-sm">
        <span className="font-medium">{label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
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

  const supplierOptions = rows ? supplierFilterOptions(rows) : [];
  const resourceOptions = rows ? resourceFilterOptions(rows) : [];
  const visible = rows ? filterDiscrepancies(rows, filters) : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {DISCREPANCIES_HEADING}
      </h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Būsena</span>
          <select
            value={filters.status}
            onChange={(event) =>
              update({
                status: event.target.value as DiscrepancyListFilters["status"],
              })
            }
            className={inputClass}
          >
            {DISCREPANCY_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {DISCREPANCY_STATUS_FILTER_LABELS[status]}
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
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Tipas</span>
          <select
            value={filters.direction}
            onChange={(event) =>
              update({
                direction: event.target
                  .value as DiscrepancyListFilters["direction"],
              })
            }
            className={inputClass}
          >
            {DISCREPANCY_DIRECTION_FILTERS.map((direction) => (
              <option key={direction} value={direction}>
                {DISCREPANCY_DIRECTION_FILTER_LABELS[direction]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Data nuo</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update({ dateFrom: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Data iki</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => update({ dateTo: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Gavimo kodas</span>
          <input
            type="search"
            value={filters.code}
            onChange={(event) => update({ code: event.target.value })}
            placeholder="G2610-01"
            className={inputClass}
          />
        </label>
        <div className="flex items-end justify-start sm:col-span-2 lg:col-span-3">
          <button
            type="button"
            onClick={() => setFilters(createDiscrepancyListFilters())}
            disabled={!hasActiveDiscrepancyFilters(filters)}
            className={`${SECONDARY_NAV_BUTTON_CLASS} disabled:opacity-60`}
          >
            {RESET_FILTERS_LABEL}
          </button>
        </div>
      </section>

      {visible === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {EMPTY_DISCREPANCIES_MESSAGE}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Data</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Gavimas
                </th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Partija
                </th>
                <th className="px-4 py-2 font-medium">Tiekėjas</th>
                <th className="px-4 py-2 font-medium">Išteklius</th>
                <th className="px-4 py-2 font-medium">Tipas</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Neatitikimas
                </th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Padengta
                </th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">
                  Likutis
                </th>
                <th className="px-4 py-2 font-medium">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="relative border-t border-border transition-colors hover:bg-accent/50 focus-within:bg-accent/50"
                >
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatBatchDateTime(row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {row.deliveryCode}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    <Link
                      href={discrepancyDetailHref(row.id)}
                      aria-label={`Atidaryti neatitikimą ${row.batchCode}`}
                      className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row.batchCode}
                      <span aria-hidden="true" className="absolute inset-0" />
                    </Link>
                  </td>
                  <td className="px-4 py-2">{row.supplierName}</td>
                  <td className="px-4 py-2">{row.resourceName}</td>
                  <td className="px-4 py-2">
                    <span className={discrepancyDirectionClass(row.direction)}>
                      {discrepancyDirectionLabel(row.direction)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {discrepancyDifferenceLabel(row.differenceWeight)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {discrepancyWeightLabel(row.settledWeight)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    {discrepancyWeightLabel(row.remainingWeight)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className={discrepancyStatusClass(row.status)}>
                      {discrepancyStatusLabel(row.status)}
                    </span>
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
