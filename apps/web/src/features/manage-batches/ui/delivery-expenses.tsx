"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  ApplyDeliveryExpensesResponse,
  Batch,
  DeliveryExpenseAllocationMethod,
  DeliveryExpensePreview,
  DeliveryExpenses,
} from "@aitvaras/contracts";
import {
  DELIVERY_EXPENSE_ALLOCATION_METHODS,
  DELIVERY_EXPENSE_ALLOCATION_METHOD_LABELS,
} from "@aitvaras/contracts";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { formatMoney } from "@/shared/lib/format";
import { focusField } from "@/shared/lib/form-feedback";
import { PRIMARY_BUTTON_CLASS, useToast } from "@/shared/ui";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function moneyInput(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "0";
  }
  const parsed = trimmed.replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(parsed) ? parsed : "";
}

function moneyDisplay(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2).replace(".", ",") : "0,00";
}

/**
 * Receipt-level transport/customs allocation on the manager screen.
 *
 * The preview shows each batch's proposed share before applying. Applying writes
 * one application ledger entry for the whole receipt, including confirmed
 * batches; a confirmed batch only changes its expense valuation.
 */
export function DeliveryExpensesBlock({
  deliveryId,
  deliveryCode,
  batches,
  onApplied,
}: {
  deliveryId: string;
  deliveryCode: string;
  batches: readonly Batch[];
  onApplied?: () => void;
}) {
  const { clearSession } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [transport, setTransport] = useState("0,00");
  const [customs, setCustoms] = useState("0,00");
  const [method, setMethod] =
    useState<DeliveryExpenseAllocationMethod>("BY_VALUE");
  const [preview, setPreview] = useState<DeliveryExpensePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const hasBatches = batches.length > 0;
  const proportionalBlocked =
    method === "BY_VALUE" &&
    preview !== null &&
    !preview.proportionalAvailable;

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

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const record = await apiFetch<DeliveryExpenses>(
        `/deliveries/${deliveryId}/expenses`,
      );
      setTransport(moneyDisplay(record.transportAmount));
      setCustoms(moneyDisplay(record.customsAmount));
      setMethod(record.allocationMethod);
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti priėmimo išlaidų");
    } finally {
      setLoading(false);
    }
  }, [deliveryId, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestPreview = useCallback(
    async (
      transportValue: string,
      customsValue: string,
      methodValue: DeliveryExpenseAllocationMethod,
    ): Promise<DeliveryExpensePreview | null> => {
      const transportAmount = moneyInput(transportValue);
      const customsAmount = moneyInput(customsValue);
      if (transportAmount === "" || customsAmount === "") {
        return null;
      }
      const result = await apiFetch<DeliveryExpensePreview>(
        `/deliveries/${deliveryId}/expenses/preview`,
        {
          method: "POST",
          body: JSON.stringify({
            transportAmount,
            customsAmount,
            allocationMethod: methodValue,
          }),
        },
      );
      setPreview(result);
      return result;
    },
    [deliveryId],
  );

  useEffect(() => {
    if (loading) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPreviewing(true);
      requestPreview(transport, customs, method)
        .catch((caught) => {
          if (!(caught instanceof ApiError) || caught.status !== 404) {
            handleError(caught, "Nepavyko apskaičiuoti paskirstymo");
          }
        })
        .finally(() => setPreviewing(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [transport, customs, method, loading, requestPreview, handleError]);

  async function apply(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const transportValue = moneyInput(transport);
    const customsValue = moneyInput(customs);
    if (transportValue === "") {
      toast.error("Įveskite teisingą transporto sumą (pvz., 125,50).");
      focusField("expense-transport");
      return;
    }
    if (customsValue === "") {
      toast.error("Įveskite teisingą muitinės sumą (pvz., 125,50).");
      focusField("expense-customs");
      return;
    }
    if (proportionalBlocked) {
      toast.error(
        preview?.proportionalBlockedReason ??
          "Proporcinis paskirstymas negalimas.",
      );
      focusField("expense-method");
      return;
    }
    setApplying(true);
    try {
      const result = await apiFetch<ApplyDeliveryExpensesResponse>(
        `/deliveries/${deliveryId}/expenses/apply`,
        {
          method: "POST",
          body: JSON.stringify({
            transportAmount: transportValue,
            customsAmount: customsValue,
            allocationMethod: method,
          }),
        },
      );
      setPreview(result);
      if (result.applied) {
        toast.success("Priėmimo išlaidos paskirstytos.");
      } else {
        toast.info("Paskirstymas nepakitęs.");
      }
      onApplied?.();
    } catch (caught) {
      handleError(caught, "Nepavyko pritaikyti paskirstymo");
    } finally {
      setApplying(false);
    }
  }

  const basis =
    method === "EQUAL"
      ? "Po lygiai kiekvienai turinčiai faktinį kiekį partijai."
      : preview?.basis === "ACQUISITION"
        ? "Pagal partijų įsigijimo vertę eurais."
        : preview?.basis === "PIECES"
          ? "Pagal priimtą vienetų kiekį."
          : "Pagal partijų neto svorį.";
  const basisWarning =
    method === "BY_VALUE" ? preview?.proportionalBlockedReason ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Priėmimo išlaidos</h3>
        <p className="text-sm text-muted-foreground">
          Priėmimo {deliveryCode} transporto ir muitinės išlaidos, paskirstomos
          visoms partijoms.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : (
        <form onSubmit={(event) => void apply(event)} noValidate className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Transportas, €</span>
              <input
                id="expense-transport"
                type="text"
                inputMode="decimal"
                value={transport}
                onChange={(event) => setTransport(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Muitinė, €</span>
              <input
                id="expense-customs"
                type="text"
                inputMode="decimal"
                value={customs}
                onChange={(event) => setCustoms(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Išlaidų paskirstymo būdas</span>
              <select
                id="expense-method"
                value={method}
                onChange={(event) =>
                  setMethod(
                    event.target.value as DeliveryExpenseAllocationMethod,
                  )
                }
                className={inputClass}
              >
                {DELIVERY_EXPENSE_ALLOCATION_METHODS.map((option) => (
                  <option
                    key={option}
                    value={option}
                    disabled={
                      option === "BY_VALUE" &&
                      preview !== null &&
                      !preview.proportionalAvailable
                    }
                  >
                    {DELIVERY_EXPENSE_ALLOCATION_METHOD_LABELS[option]}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">{basis}</span>
            </label>
          </div>

          {basisWarning ? (
            <p className="text-xs text-destructive">{basisWarning}</p>
          ) : null}

          {!hasBatches ? (
            <p className="text-sm text-muted-foreground">
              Priėmime dar nėra partijų, todėl paskirstymo nėra.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Partija</th>
                    <th className="px-4 py-2 font-medium">Prekė</th>
                    <th className="px-4 py-2 font-medium">Priimta</th>
                    <th className="px-4 py-2 font-medium">
                      Įsigijimo vertė, €
                    </th>
                    <th className="px-4 py-2 font-medium">Transportas, €</th>
                    <th className="px-4 py-2 font-medium">Muitinė, €</th>
                  </tr>
                </thead>
                <tbody>
                  {preview?.batches.map((batch) => (
                    <tr key={batch.batchId} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2 font-medium">
                        {batch.code}
                      </td>
                      <td className="px-4 py-2">
                        {batch.resourceName ??
                          (batch.receivingMode === "PIECE"
                            ? "Vienetinė partija"
                            : "—")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {batch.receivingMode === "WEIGHT"
                          ? `${batch.actualQuantity} kg`
                          : `${batch.actualQuantity} vnt.`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {batch.acquisitionAmount === null
                          ? "—"
                          : formatMoney(batch.acquisitionAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {formatMoney(batch.proposedTransportAmount)}
                        {batch.currentTransportAmount !==
                        batch.proposedTransportAmount ? (
                          <span className="block text-xs text-muted-foreground">
                            dabar {formatMoney(batch.currentTransportAmount)}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {formatMoney(batch.proposedCustomsAmount)}
                        {batch.currentCustomsAmount !==
                        batch.proposedCustomsAmount ? (
                          <span className="block text-xs text-muted-foreground">
                            dabar {formatMoney(batch.currentCustomsAmount)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview ? (
            <div className="grid gap-1 text-sm">
              <p>
                Paskirstyta: transportas{" "}
                <span className="font-medium">
                  {formatMoney(preview.allocatedTransportTotal)}
                </span>
                , muitinė{" "}
                <span className="font-medium">
                  {formatMoney(preview.allocatedCustomsTotal)}
                </span>
              </p>
              <p className="text-muted-foreground">
                Nepaskirstyta: transportas{" "}
                {formatMoney(preview.unallocatedTransport)}, muitinė{" "}
                {formatMoney(preview.unallocatedCustoms)}.
              </p>
              {preview.lastAppliedAt ? (
                <p className="text-xs text-muted-foreground">
                  Paskutinį kartą pritaikė{" "}
                  {preview.lastAppliedByName ?? "—"}{" "}
                  {new Date(preview.lastAppliedAt).toLocaleString("lt-LT")}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            {previewing ? (
              <span className="text-xs text-muted-foreground">
                Skaičiuojama…
              </span>
            ) : null}
            <button
              type="submit"
              disabled={
                applying || previewing || !hasBatches || proportionalBlocked
              }
              className={PRIMARY_BUTTON_CLASS}
            >
              {applying ? "Taikoma…" : "Pritaikyti paskirstymą"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
