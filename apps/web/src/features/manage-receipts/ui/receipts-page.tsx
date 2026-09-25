"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MEASUREMENT_UNIT_KEYS,
  MEASUREMENT_UNIT_LABELS,
  type GoodsReceipt,
  type MeasurementUnitKey,
  type Partner,
  type Resource,
  type WarehouseWithLocations,
} from "@aitvaras/contracts";
import { EMPTY_RECEIPTS_MESSAGE, formatMoney, formatReceiptDate } from "@/entities/receipt";
import { activeSuppliers } from "@/entities/partner";
import { activeResources } from "@/entities/resource";
import { activeWarehouses, locationsForWarehouse } from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  addDraftLine,
  createDraftReceipt,
  draftLineTotal,
  draftTotal,
  receiptFormError,
  removeDraftLine,
  setDraftLineWarehouse,
  toCreateReceiptPayload,
  updateDraftLine,
  type DraftReceipt,
} from "../lib/receipt-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** Pajamavimas: create a receipt (with warehouse placement) and review receipts. */
export function ReceiptsPage() {
  const router = useRouter();
  const { clearSession } = useAuth();

  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[] | null>(
    null,
  );
  const [receipts, setReceipts] = useState<GoodsReceipt[] | null>(null);
  const [draft, setDraft] = useState<DraftReceipt>(createDraftReceipt);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const reloadReceipts = useCallback(async (): Promise<void> => {
    try {
      setReceipts(await apiFetch<GoodsReceipt[]>("/receipts"));
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti pajamavimų");
    }
  }, [handleError]);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const [partnerList, resourceList, warehouseList, receiptList] =
          await Promise.all([
            apiFetch<Partner[]>("/partners"),
            apiFetch<Resource[]>("/resources"),
            apiFetch<WarehouseWithLocations[]>("/warehouses"),
            apiFetch<GoodsReceipt[]>("/receipts"),
          ]);
        if (!active) {
          return;
        }
        setPartners(partnerList);
        setResources(resourceList);
        setWarehouses(warehouseList);
        setReceipts(receiptList);
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti pajamavimo duomenų");
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
    const validation = receiptFormError(draft);
    if (validation) {
      setError(validation);
      setSuccess(null);
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch<GoodsReceipt>("/receipts", {
        method: "POST",
        body: JSON.stringify(toCreateReceiptPayload(draft)),
      });
      setDraft(createDraftReceipt());
      setSuccess("Pajamavimas išsaugotas.");
      await reloadReceipts();
    } catch (caught) {
      handleError(caught, "Nepavyko išsaugoti pajamavimo");
    } finally {
      setSubmitting(false);
    }
  }

  const supplierOptions = partners ? activeSuppliers(partners) : [];
  const resourceOptions = resources ? activeResources(resources) : [];
  const warehouseOptions = warehouses ? activeWarehouses(warehouses) : [];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Pajamavimas</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm text-muted-foreground">
          {success}
        </p>
      ) : null}

      <section className={workSurfaceClass()}>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1 text-sm sm:max-w-md">
            <span className="font-medium">Partneris (tiekėjas)</span>
            <select
              required
              value={draft.partnerId}
              onChange={(event) =>
                setDraft({ ...draft, partnerId: event.target.value })
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

          <div className="grid gap-5">
            {draft.lines.map((line) => {
              const lineTotal = draftLineTotal(line);
              const locationOptions = warehouses
                ? locationsForWarehouse(warehouses, line.warehouseId)
                : [];
              return (
                <div
                  key={line.key}
                  className="grid gap-3 border-t border-border pt-4"
                >
                  <div className="grid gap-3 sm:grid-cols-12">
                    <label className="grid gap-1 text-sm sm:col-span-4">
                      <span className="font-medium">Išteklius</span>
                      <select
                        required
                        value={line.resourceId}
                        onChange={(event) =>
                          setDraft((current) =>
                            updateDraftLine(current, line.key, {
                              resourceId: event.target.value,
                            }),
                          )
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

                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="font-medium">Kiekis</span>
                      <input
                        required
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.001"
                        value={line.quantity}
                        onChange={(event) =>
                          setDraft((current) =>
                            updateDraftLine(current, line.key, {
                              quantity: event.target.value,
                            }),
                          )
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="font-medium">Matavimo vnt.</span>
                      <select
                        value={line.unit}
                        onChange={(event) =>
                          setDraft((current) =>
                            updateDraftLine(current, line.key, {
                              unit: event.target.value as MeasurementUnitKey,
                            }),
                          )
                        }
                        className={inputClass}
                      >
                        {MEASUREMENT_UNIT_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {MEASUREMENT_UNIT_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 text-sm sm:col-span-2">
                      <span className="font-medium">Vieneto kaina</span>
                      <input
                        required
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.0001"
                        value={line.unitPrice}
                        onChange={(event) =>
                          setDraft((current) =>
                            updateDraftLine(current, line.key, {
                              unitPrice: event.target.value,
                            }),
                          )
                        }
                        className={inputClass}
                      />
                    </label>

                    <div className="flex items-end justify-between gap-2 sm:col-span-2">
                      <span className="text-sm text-muted-foreground">
                        {lineTotal === null ? "—" : formatMoney(lineTotal)}
                      </span>
                      {draft.lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) =>
                              removeDraftLine(current, line.key),
                            )
                          }
                          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Šalinti
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-12">
                    <label className="grid gap-1 text-sm sm:col-span-6">
                      <span className="font-medium">Sandėlis *</span>
                      <select
                        required
                        value={line.warehouseId}
                        onChange={(event) =>
                          setDraft((current) =>
                            setDraftLineWarehouse(
                              current,
                              line.key,
                              event.target.value,
                            ),
                          )
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

                    <label className="grid gap-1 text-sm sm:col-span-6">
                      <span className="font-medium">Vieta</span>
                      <select
                        disabled={line.warehouseId === ""}
                        value={line.warehouseLocationId}
                        onChange={(event) =>
                          setDraft((current) =>
                            updateDraftLine(current, line.key, {
                              warehouseLocationId: event.target.value,
                            }),
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          {line.warehouseId === ""
                            ? "Pirmiausia pasirinkite sandėlį"
                            : "— Be konkrečios vietos —"}
                        </option>
                        {locationOptions.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setDraft((current) => addDraftLine(current))}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              + Pridėti eilutę
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="text-sm font-medium">
              Iš viso: {formatMoney(draftTotal(draft))}
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {submitting ? "Saugoma…" : "Išsaugoti"}
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Pajamavimai</h2>
        {receipts === null ? (
          <p className="text-sm text-muted-foreground">Kraunama…</p>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_RECEIPTS_MESSAGE}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Partneris</th>
                  <th className="px-4 py-2 font-medium">Eilučių skaičius</th>
                  <th className="px-4 py-2 font-medium">Suma</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link
                        href={`/receipts/${receipt.id}`}
                        className="font-medium hover:underline"
                      >
                        {formatReceiptDate(receipt.createdAt)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{receipt.partnerName}</td>
                    <td className="px-4 py-2">{receipt.lines.length}</td>
                    <td className="px-4 py-2">{formatMoney(receipt.total)}</td>
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
