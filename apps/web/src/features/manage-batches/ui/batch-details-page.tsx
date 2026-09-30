"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  Bag,
  BatchDetail,
  BatchReconciliation,
} from "@aitvaras/contracts";
import {
  bagStatusClass,
  bagStatusLabel,
  batchStatusLabel,
  correctionKindLabel,
  EMPTY_BAGS_MESSAGE,
  EMPTY_CORRECTIONS_MESSAGE,
  formatArrivalDate,
  formatBatchDateTime,
  formatQuantity,
  formatWeight,
  formatWeightDifference,
  GAVIMAI_ACTION,
  handlingUnitLabel,
  isBatchConfirmed,
  weightsMatch,
} from "@/entities/batch";
import { formatMoney } from "@/entities/receipt";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { CONFIRM_RECEIPT_LABEL } from "../lib/batch-list";
import {
  createDraftReconciliation,
  reconciliationFormError,
  toReconcilePayload,
  type DraftReconciliation,
} from "../lib/batch-form";
import { bagLabelData } from "../lib/receiving";
import { BagLabel } from "./bag-label";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/**
 * ADMIN batch (partija) review: batch context, a read-only list of the registered
 * units, and — for ADMIN — formal reconciliation/confirmation.
 *
 * Physical bag registration belongs exclusively to the warehouse-worker
 * `Registruoti sandėlyje` flow and is deliberately **not** present here. The
 * reconciliation form exposes formal/business data only; the internal
 * `GoodsReceiptLine` anchor is resolved server-side. The measured weight is
 * always the server-derived SUM of the units' quantities; the client never sends
 * it.
 */
export function BatchDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftReconciliation, setDraftReconciliation] =
    useState<DraftReconciliation>(createDraftReconciliation);
  const [labelBag, setLabelBag] = useState<Bag | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canReconcile = Boolean(user?.roles.includes("ADMIN"));

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
        const batchResult = await apiFetch<BatchDetail>(`/batches/${id}`);
        if (!active) {
          return;
        }
        setBatch(batchResult);
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

  // Keep the reconciliation draft aligned with the loaded batch (existing
  // documentary values prefill the form on a discrepancy retry).
  useEffect(() => {
    if (!batch) {
      return;
    }
    setDraftReconciliation({
      documentWeight: batch.documentWeight ?? "",
      acquisitionAmount: batch.acquisitionAmount ?? "",
      documentDate: batch.documentDate ? batch.documentDate.slice(0, 10) : "",
      documentNumber: batch.documentNumber ?? "",
    });
  }, [batch]);

  async function submitReconciliation(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const validation = reconciliationFormError(draftReconciliation);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    setReconciling(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<BatchReconciliation>(
        `/batches/${id}/reconcile`,
        {
          method: "POST",
          body: JSON.stringify(toReconcilePayload(draftReconciliation)),
        },
      );
      setNotice(
        result.status === "CONFIRMED"
          ? "Gavimas patvirtintas."
          : "Užfiksuotas neatitikimas — dokumentinis ir faktiškas svoris nesutampa.",
      );
      await loadBatch();
    } catch (caught) {
      handleError(caught, "Nepavyko patvirtinti gavimo");
    } finally {
      setReconciling(false);
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
        <Link href={GAVIMAI_ACTION.href} className="text-sm hover:underline">
          ← {GAVIMAI_ACTION.label}
        </Link>
      </div>
    );
  }

  if (!batch) {
    return <p className="text-sm text-muted-foreground">Partija nerasta.</p>;
  }

  const confirmed = isBatchConfirmed(batch.status);
  const totalQuantityLabel = batch.unit
    ? formatQuantity(batch.totalQuantity, batch.unit)
    : "—";
  const draftDocumentWeight = draftReconciliation.documentWeight.trim();
  const liveDifference =
    draftDocumentWeight === ""
      ? null
      : formatWeightDifference(draftDocumentWeight, batch.totalQuantity);
  const liveMatches =
    draftDocumentWeight !== "" &&
    weightsMatch(draftDocumentWeight, batch.totalQuantity);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={GAVIMAI_ACTION.href} className="text-sm hover:underline">
          ← {GAVIMAI_ACTION.label}
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
            <dt className="text-sm font-medium">Maišai / kiekis</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.bagCount} · {totalQuantityLabel}
            </dd>
          </div>
        </dl>
      </section>

      {confirmed ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium">Gavimo patvirtinimas</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium">Faktiškai susverta</dt>
              <dd className="text-sm text-muted-foreground">
                {totalQuantityLabel}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Dokumentuose</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.documentWeight ? formatWeight(batch.documentWeight) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Skirtumas</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.difference ? formatWeight(batch.difference) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Įsigijimo vertė</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.acquisitionAmount ? formatMoney(batch.acquisitionAmount) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Dokumentas</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.documentNumber ??
                  (batch.receiptId ? `#${batch.receiptId.slice(0, 8)}` : "—")}
                {batch.documentDate
                  ? ` · ${formatArrivalDate(batch.documentDate)}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Patvirtinta</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.confirmedAt
                  ? formatBatchDateTime(batch.confirmedAt)
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {!confirmed && canReconcile ? (
        <section className={workSurfaceClass()}>
          {batch.bagCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Patvirtinti galima tik partiją su bent vienu maišu.
            </p>
          ) : (
            <form onSubmit={submitReconciliation} className="grid gap-4">
              <h2 className="text-lg font-medium">{CONFIRM_RECEIPT_LABEL}</h2>
              {batch.status === "DISCREPANCY" ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Užfiksuotas neatitikimas. Pataisykite dokumentinį svorį ir
                  patvirtinkite iš naujo.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Dokumentinis svoris</span>
                  <input
                    required
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.001"
                    value={draftReconciliation.documentWeight}
                    onChange={(event) =>
                      setDraftReconciliation({
                        ...draftReconciliation,
                        documentWeight: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Įsigijimo vertė</span>
                  <input
                    required
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draftReconciliation.acquisitionAmount}
                    onChange={(event) =>
                      setDraftReconciliation({
                        ...draftReconciliation,
                        acquisitionAmount: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Dokumento data</span>
                  <input
                    type="date"
                    value={draftReconciliation.documentDate}
                    onChange={(event) =>
                      setDraftReconciliation({
                        ...draftReconciliation,
                        documentDate: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Dokumento Nr.</span>
                  <input
                    type="text"
                    maxLength={64}
                    value={draftReconciliation.documentNumber}
                    onChange={(event) =>
                      setDraftReconciliation({
                        ...draftReconciliation,
                        documentNumber: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <dl className="grid gap-x-8 gap-y-2 border-t border-border pt-4 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-medium">Faktiškai susverta</dt>
                  <dd className="text-sm text-muted-foreground">
                    {totalQuantityLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Dokumentuose</dt>
                  <dd className="text-sm text-muted-foreground">
                    {draftDocumentWeight === ""
                      ? "—"
                      : formatWeight(draftDocumentWeight)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium">Skirtumas</dt>
                  <dd
                    className={
                      liveDifference && !liveMatches
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {liveDifference ?? "—"}
                    {liveDifference && !liveMatches ? " (neatitikimas)" : ""}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center justify-end border-t border-border pt-4">
                <button
                  type="submit"
                  disabled={reconciling}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {reconciling ? "Tvirtinama…" : CONFIRM_RECEIPT_LABEL}
                </button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Partijos maišai</h2>
        {batch.bags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_BAGS_MESSAGE}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Barkodas</th>
                  <th className="px-4 py-2 font-medium">Vieta</th>
                  <th className="px-4 py-2 font-medium">Kiekis</th>
                  <th className="px-4 py-2 font-medium">Mato vnt.</th>
                  <th className="px-4 py-2 font-medium">Būsena</th>
                  <th className="px-4 py-2 font-medium">Užregistruota</th>
                  <th className="px-4 py-2 font-medium">Etiketė</th>
                </tr>
              </thead>
              <tbody>
                {batch.bags.map((bag) => (
                  <tr
                    key={bag.id}
                    className={
                      bag.status === "VOIDED"
                        ? "border-t border-border text-muted-foreground"
                        : "border-t border-border"
                    }
                  >
                    <td className="px-4 py-2 font-mono">{bag.barcode}</td>
                    <td className="px-4 py-2">{bag.warehouseLocationName}</td>
                    <td className="px-4 py-2">{bag.quantity}</td>
                    <td className="px-4 py-2">{handlingUnitLabel(bag.unit)}</td>
                    <td className="px-4 py-2">
                      <span className={bagStatusClass(bag.status)}>
                        {bagStatusLabel(bag.status)}
                      </span>
                      {bag.status === "VOIDED" && bag.voidReason ? (
                        <span className="block text-xs text-muted-foreground">
                          {bag.voidReason}
                        </span>
                      ) : null}
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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Pataisymų istorija</h2>
        {batch.corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {EMPTY_CORRECTIONS_MESSAGE}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Tipas</th>
                  <th className="px-4 py-2 font-medium">Barkodas</th>
                  <th className="px-4 py-2 font-medium">Buvo</th>
                  <th className="px-4 py-2 font-medium">Dabar</th>
                  <th className="px-4 py-2 font-medium">Priežastis</th>
                  <th className="px-4 py-2 font-medium">Atliko</th>
                </tr>
              </thead>
              <tbody>
                {batch.corrections.map((correction) => (
                  <tr key={correction.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      {correctionKindLabel(correction.kind)}
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {correction.bagBarcode}
                    </td>
                    <td className="px-4 py-2">{correction.previousValue ?? "—"}</td>
                    <td className="px-4 py-2">{correction.newValue ?? "—"}</td>
                    <td className="px-4 py-2">{correction.reason ?? "—"}</td>
                    <td className="px-4 py-2">
                      {correction.createdByName} ·{" "}
                      {formatBatchDateTime(correction.createdAt)}
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
          <BagLabel label={bagLabelData(batch, labelBag)} />
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
