"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  Bag,
  BatchDetail,
  BatchPieceConfirmation,
  BatchReconciliation,
} from "@aitvaras/contracts";
import {
  bagStatusClass,
  bagStatusLabel,
  batchItemStatusClass,
  batchItemStatusLabel,
  batchReceivingModeLabel,
  batchStatusLabel,
  correctionKindLabel,
  EMPTY_BAGS_MESSAGE,
  EMPTY_BATCH_ITEMS_MESSAGE,
  EMPTY_CORRECTIONS_MESSAGE,
  formatArrivalDate,
  formatBatchDateTime,
  formatPieces,
  formatSignedPieces,
  formatSignedWeight,
  formatWeight,
  formatWeightDifference,
  GAVIMAI_ACTION,
  canReceiveStock,
  isBatchConfirmed,
  weightsMatch,
} from "@/entities/batch";
import { formatMoney } from "@/shared/lib/format";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { isoDatePart } from "@/shared/lib/date";
import { focusField } from "@/shared/lib/form-feedback";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  DateInput,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_NAV_BUTTON_CLASS,
  useToast,
} from "@/shared/ui";
import { CONFIRM_RECEIPT_LABEL } from "../lib/batch-list";
import {
  createDraftPieceConfirmation,
  createDraftReconciliation,
  pieceConfirmationFormError,
  pieceConfirmationRows,
  pieceRowDifference,
  reconciliationFormError,
  toConfirmPiecePayload,
  toReconcilePayload,
  type DraftPieceConfirmation,
  type DraftReconciliation,
  type PieceConfirmationRow,
} from "../lib/batch-form";
import {
  activeBatchItems,
  bagLabelData,
  batchTotalPieces,
  voidedBatchItems,
} from "../lib/receiving";
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
  const toast = useToast();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftReconciliation, setDraftReconciliation] =
    useState<DraftReconciliation>(createDraftReconciliation);
  const [labelBag, setLabelBag] = useState<Bag | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [showDiscrepancyDialog, setShowDiscrepancyDialog] = useState(false);
  const [draftPiece, setDraftPiece] = useState<DraftPieceConfirmation>(
    createDraftPieceConfirmation,
  );
  const [confirmingPiece, setConfirmingPiece] = useState(false);
  const [showPieceDialog, setShowPieceDialog] = useState(false);

  const canReconcile = Boolean(user?.roles.includes("ADMIN"));
  const canEditRegistration = user ? canReceiveStock(user.roles) : false;

  const handleError = useCallback(
    (caught: unknown, fallback: string): void => {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setLoadError("Partija nerasta.");
        return;
      }
      setLoadError(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router],
  );

  const handleOperationError = useCallback(
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
        setLoadError(null);
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
      documentPieces:
        batch.documentPieces === null ? "" : String(batch.documentPieces),
      documentDate: batch.documentDate ? isoDatePart(batch.documentDate) : "",
      documentNumber: batch.documentNumber ?? "",
    });
    if (batch.receivingMode === "PIECE") {
      setDraftPiece({
        acquisitionAmount: batch.acquisitionAmount ?? "",
        documentDate: batch.documentDate ? isoDatePart(batch.documentDate) : "",
        documentNumber: batch.documentNumber ?? "",
        products: pieceConfirmationRows(
          batch.pieceReconciliation.map((row) => ({
            resourceId: row.resourceId,
            resourceName: row.resourceName,
            actualPieces: row.actualPieces,
          })),
        ),
      });
    }
  }, [batch]);

  async function reconcileWith(acknowledge: boolean): Promise<void> {
    setReconciling(true);
    try {
      const result = await apiFetch<BatchReconciliation>(
        `/batches/${id}/reconcile`,
        {
          method: "POST",
          body: JSON.stringify({
            ...toReconcilePayload(draftReconciliation),
            ...(acknowledge ? { acknowledgeDiscrepancy: true } : {}),
          }),
        },
      );
      setShowDiscrepancyDialog(false);
      toast.success(
        result.discrepancyId
          ? `Priėmimas patvirtintas. Neatitikimas ${formatSignedWeight(result.difference)} užregistruotas.`
          : "Priėmimas patvirtintas.",
      );
      await loadBatch();
    } catch (caught) {
      setShowDiscrepancyDialog(false);
      handleOperationError(caught, "Nepavyko patvirtinti priėmimo");
    } finally {
      setReconciling(false);
    }
  }

  function submitReconciliation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const validation = reconciliationFormError(draftReconciliation);
    if (validation) {
      toast.error(validation);
      focusField(
        draftReconciliation.documentWeight.trim() === ""
          ? "document-weight"
          : draftReconciliation.acquisitionAmount.trim() === ""
            ? "document-acquisition-amount"
            : "document-date",
      );
      return;
    }
    // A non-zero difference does not block confirmation, but the ADMIN must
    // acknowledge it first (a modal), which records a separate discrepancy.
    if (liveDifference !== null && !liveMatches) {
      setShowDiscrepancyDialog(true);
      return;
    }
    void reconcileWith(false);
  }

  function pieceRowsOf(target: BatchDetail): PieceConfirmationRow[] {
    return target.pieceReconciliation.map((row) => ({
      resourceId: row.resourceId,
      resourceName: row.resourceName,
      actualPieces: row.actualPieces,
    }));
  }

  async function confirmPieceWith(acknowledge: boolean): Promise<void> {
    if (!batch) {
      return;
    }
    setConfirmingPiece(true);
    try {
      const rows = pieceRowsOf(batch);
      const result = await apiFetch<BatchPieceConfirmation>(
        `/batches/${id}/confirm-piece`,
        {
          method: "POST",
          body: JSON.stringify(
            toConfirmPiecePayload(draftPiece, rows, acknowledge),
          ),
        },
      );
      setShowPieceDialog(false);
      toast.success(
        `Partija patvirtinta. Faktiškai užregistruota ${result.totalPieces} vnt.`,
      );
      await loadBatch();
    } catch (caught) {
      setShowPieceDialog(false);
      handleOperationError(caught, "Nepavyko patvirtinti partijos");
    } finally {
      setConfirmingPiece(false);
    }
  }

  function submitPieceConfirmation(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!batch) {
      return;
    }
    const rows = pieceRowsOf(batch);
    const validation = pieceConfirmationFormError(draftPiece, rows);
    if (validation) {
      toast.error(validation);
      focusField(
        draftPiece.acquisitionAmount.trim() === ""
          ? "piece-acquisition-amount"
          : "piece-document-date",
      );
      return;
    }
    // A mismatch does not block confirmation; the ADMIN acknowledges it first.
    if (rows.some((row) => pieceRowDifference(draftPiece, row) !== 0)) {
      setShowPieceDialog(true);
      return;
    }
    void confirmPieceWith(false);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (loadError && !batch) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
        <Link href={GAVIMAI_ACTION.href} className={SECONDARY_NAV_BUTTON_CLASS}>
          ← {GAVIMAI_ACTION.label}
        </Link>
      </div>
    );
  }

  if (!batch) {
    return <p className="text-sm text-muted-foreground">Partija nerasta.</p>;
  }

  if (batch.receivingMode === "PIECE") {
    const pieceConfirmed = isBatchConfirmed(batch.status);
    const activeItems = activeBatchItems(batch);
    const voidedItems = voidedBatchItems(batch);
    const pieceRows = pieceRowsOf(batch);
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href={GAVIMAI_ACTION.href}
              className={SECONDARY_NAV_BUTTON_CLASS}
            >
              ← {GAVIMAI_ACTION.label}
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">
              Priėmimas {batch.deliveryCode}
            </h1>
            <p className="text-sm text-muted-foreground">
              Partija {batch.code} ·{" "}
              {batchReceivingModeLabel(batch.receivingMode)}
            </p>
          </div>
          {canEditRegistration && batch.status === "PENDING" ? (
            <Link
              href={`/receiving/${batch.deliveryId}/batches/${batch.id}`}
              className={SECONDARY_NAV_BUTTON_CLASS}
            >
              Redaguoti partiją
            </Link>
          ) : null}
        </div>

        <section className={workSurfaceClass()}>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <ContextField label="Priėmimas" value={batch.deliveryCode} />
            <ContextField
              label="Būsena"
              value={batchStatusLabel(batch.status)}
            />
            <ContextField
              label="Priėmimo data"
              value={formatArrivalDate(batch.arrivalDate)}
            />
            <ContextField
              label="Tipas"
              value={batchReceivingModeLabel(batch.receivingMode)}
            />
            <ContextField label="Tiekėjas" value={batch.supplierName} />
            <ContextField label="Sandėlis" value={batch.warehouseName} />
            <ContextField label="Eilutės" value={String(batch.itemLineCount)} />
            <ContextField
              label="Iš viso"
              value={formatPieces(batch.totalPieces)}
            />
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Prekės</h2>
          {activeItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {EMPTY_BATCH_ITEMS_MESSAGE}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Prekė</th>
                    <th className="px-4 py-2 font-medium">Kiekis</th>
                    <th className="px-4 py-2 font-medium">Vieta</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-2">{item.resourceName}</td>
                      <td className="px-4 py-2">{item.quantity} vnt.</td>
                      <td className="px-4 py-2">
                        {item.warehouseLocationName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm font-medium">
            Iš viso: {formatPieces(batchTotalPieces(batch))}
          </p>
        </section>

        {voidedItems.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Anuliuotos eilutės</h2>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Prekė</th>
                    <th className="px-4 py-2 font-medium">Kiekis</th>
                    <th className="px-4 py-2 font-medium">Būsena</th>
                    <th className="px-4 py-2 font-medium">Priežastis</th>
                  </tr>
                </thead>
                <tbody>
                  {voidedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-border text-muted-foreground"
                    >
                      <td className="px-4 py-2">{item.resourceName}</td>
                      <td className="px-4 py-2">{item.quantity} vnt.</td>
                      <td className="px-4 py-2">
                        <span className={batchItemStatusClass(item.status)}>
                          {batchItemStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2">{item.voidReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {pieceConfirmed ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Priėmimo patvirtinimas</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Prekė</th>
                    <th className="px-4 py-2 font-medium">Faktiškai</th>
                    <th className="px-4 py-2 font-medium">Dokumentuose</th>
                    <th className="px-4 py-2 font-medium">Skirtumas</th>
                  </tr>
                </thead>
                <tbody>
                  {pieceRows.map((row) => {
                    const line = batch.pieceReconciliation.find(
                      (entry) => entry.resourceId === row.resourceId,
                    );
                    const documentPieces = line?.documentPieces ?? null;
                    const difference = line?.differencePieces ?? 0;
                    return (
                      <tr key={row.resourceId} className="border-t border-border">
                        <td className="px-4 py-2">{row.resourceName}</td>
                        <td className="px-4 py-2">
                          {formatPieces(row.actualPieces)}
                        </td>
                        <td className="px-4 py-2">
                          {documentPieces === null
                            ? "—"
                            : formatPieces(documentPieces)}
                        </td>
                        <td
                          className={`px-4 py-2 ${
                            difference !== 0
                              ? "font-medium text-rose-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {formatSignedPieces(difference)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <ContextField
                label="Faktiškai užregistruota"
                value={formatPieces(batch.totalPieces)}
              />
              <ContextField
                label="Dokumentuose"
                value={formatPieces(
                  batch.pieceReconciliation.reduce(
                    (sum, line) => sum + (line.documentPieces ?? 0),
                    0,
                  ),
                )}
              />
              <ContextField
                label="Įsigijimo vertė"
                value={
                  batch.acquisitionAmount
                    ? formatMoney(batch.acquisitionAmount)
                    : "—"
                }
              />
              <ContextField
                label="Dokumento data"
                value={
                  batch.documentDate
                    ? formatArrivalDate(batch.documentDate)
                    : "—"
                }
              />
              <ContextField
                label="Dokumento Nr."
                value={batch.documentNumber ?? "—"}
              />
              <ContextField
                label="Patvirtinta"
                value={
                  batch.confirmedAt
                    ? formatBatchDateTime(batch.confirmedAt)
                    : "—"
                }
              />
            </dl>
          </section>
        ) : canReconcile ? (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-medium">Priėmimo patvirtinimas</h2>
            <form onSubmit={submitPieceConfirmation} noValidate className="mt-4 grid gap-4">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Prekė</th>
                      <th className="px-4 py-2 font-medium">Faktiškai</th>
                      <th className="px-4 py-2 font-medium">Sutampa</th>
                      <th className="px-4 py-2 font-medium">Dokumentuose</th>
                      <th className="px-4 py-2 font-medium">Skirtumas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pieceRows.map((row) => {
                      const product =
                        draftPiece.products[row.resourceId] ?? {
                          matches: true,
                          documentPieces: String(row.actualPieces),
                        };
                      const difference = pieceRowDifference(draftPiece, row);
                      return (
                        <tr key={row.resourceId} className="border-t border-border">
                          <td className="px-4 py-2">{row.resourceName}</td>
                          <td className="px-4 py-2">
                            {formatPieces(row.actualPieces)}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Sutampa ${row.resourceName}`}
                              checked={product.matches}
                              onChange={(event) =>
                                setDraftPiece((current) => ({
                                  ...current,
                                  products: {
                                    ...current.products,
                                    [row.resourceId]: {
                                      matches: event.target.checked,
                                      documentPieces: event.target.checked
                                        ? String(row.actualPieces)
                                        : (current.products[row.resourceId]
                                            ?.documentPieces ??
                                          String(row.actualPieces)),
                                    },
                                  },
                                }))
                              }
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              disabled={product.matches}
                              value={product.documentPieces}
                              onChange={(event) =>
                                setDraftPiece((current) => ({
                                  ...current,
                                  products: {
                                    ...current.products,
                                    [row.resourceId]: {
                                      matches: false,
                                      documentPieces: event.target.value,
                                    },
                                  },
                                }))
                              }
                              className={`${inputClass} w-24`}
                            />
                          </td>
                          <td
                            className={`px-4 py-2 ${
                              difference !== 0
                                ? "font-medium text-rose-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatSignedPieces(difference)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Faktiškai užregistruota</span>
                  <input
                    readOnly
                    value={formatPieces(batch.totalPieces)}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Įsigijimo vertė</span>
                  <input
                    id="piece-acquisition-amount"
                    required
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draftPiece.acquisitionAmount}
                    onChange={(event) =>
                      setDraftPiece({
                        ...draftPiece,
                        acquisitionAmount: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Dokumento data</span>
                  <DateInput
                    id="piece-document-date"
                    value={draftPiece.documentDate}
                    onChange={(documentDate) =>
                      setDraftPiece({
                        ...draftPiece,
                        documentDate,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Dokumento Nr.</span>
                  <input
                    type="text"
                    maxLength={64}
                    value={draftPiece.documentNumber}
                    onChange={(event) =>
                      setDraftPiece({
                        ...draftPiece,
                        documentNumber: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={confirmingPiece}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {confirmingPiece ? "Patvirtinama…" : CONFIRM_RECEIPT_LABEL}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">Laukiama patvirtinimo.</p>
        )}

        {showPieceDialog ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="piece-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          >
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 id="piece-dialog-title" className="text-lg font-medium">
                Patvirtinti priėmimą su neatitikimais?
              </h2>
              <ul className="mt-3 grid gap-1 text-sm">
                {pieceRows
                  .filter((row) => pieceRowDifference(draftPiece, row) !== 0)
                  .map((row) => (
                    <li key={row.resourceId}>
                      {row.resourceName}:{" "}
                      <span className="font-medium text-rose-600">
                        {formatSignedPieces(pieceRowDifference(draftPiece, row))}
                      </span>
                    </li>
                  ))}
              </ul>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPieceDialog(false)}
                  className={SECONDARY_NAV_BUTTON_CLASS}
                >
                  Ne
                </button>
                <button
                  type="button"
                  onClick={() => void confirmPieceWith(true)}
                  disabled={confirmingPiece}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {confirmingPiece ? "Tvirtinama…" : "Taip, patvirtinti"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const confirmed = isBatchConfirmed(batch.status);
  const totalWeightLabel = formatWeight(batch.totalNetWeight);
  const draftDocumentWeight = draftReconciliation.documentWeight.trim();
  const liveDifference =
    draftDocumentWeight === ""
      ? null
      : formatWeightDifference(batch.totalNetWeight, draftDocumentWeight);
  const liveMatches =
    draftDocumentWeight !== "" &&
    weightsMatch(draftDocumentWeight, batch.totalNetWeight);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={GAVIMAI_ACTION.href} className={SECONDARY_NAV_BUTTON_CLASS}>
            ← {GAVIMAI_ACTION.label}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Priėmimas {batch.deliveryCode}
          </h1>
          <p className="text-sm text-muted-foreground">Partija {batch.code}</p>
        </div>
        {canEditRegistration && batch.status === "PENDING" ? (
          <Link
            href={`/receiving/${batch.deliveryId}/batches/${batch.id}`}
            className={SECONDARY_NAV_BUTTON_CLASS}
          >
            Redaguoti partiją
          </Link>
        ) : null}
      </div>

      {batch.hasOpenDiscrepancy ? (
        <p role="status" className="text-sm text-destructive">
          Užregistruotas nepadengtas neatitikimas:{" "}
          {batch.difference ? formatSignedWeight(batch.difference) : "—"}.
        </p>
      ) : null}

      <section className={workSurfaceClass()}>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium">Priėmimas</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.deliveryCode}
            </dd>
          </div>
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
            <dt className="text-sm font-medium">Pakuotės / svoris</dt>
            <dd className="text-sm text-muted-foreground">
              {batch.bagCount} · {totalWeightLabel}
            </dd>
          </div>
        </dl>
      </section>

      {confirmed ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-medium">Priėmimo patvirtinimas</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium">Faktiškai susverta</dt>
              <dd className="text-sm text-muted-foreground">
                {totalWeightLabel}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Dokumentuose</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.documentWeight ? formatWeight(batch.documentWeight) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Dokumentiniai vienetai</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.documentPieces === null ? "—" : batch.documentPieces}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Skirtumas</dt>
              <dd className="text-sm text-muted-foreground">
                {batch.difference ? formatSignedWeight(batch.difference) : "—"}
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
              Patvirtinti galima tik partiją su bent viena pakuote.
            </p>
          ) : (
            <form onSubmit={submitReconciliation} noValidate className="grid gap-4">
              <h2 className="text-lg font-medium">{CONFIRM_RECEIPT_LABEL}</h2>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Dokumentinis svoris</span>
                  <input
                    id="document-weight"
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
                  <span className="font-medium">Dokumentiniai vienetai</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={draftReconciliation.documentPieces}
                    onChange={(event) =>
                      setDraftReconciliation({
                        ...draftReconciliation,
                        documentPieces: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Įsigijimo vertė</span>
                  <input
                    id="document-acquisition-amount"
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
                  <DateInput
                    id="document-date"
                    value={draftReconciliation.documentDate}
                    onChange={(documentDate) =>
                      setDraftReconciliation({
                        ...draftReconciliation,
                        documentDate,
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
                    {totalWeightLabel}
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
        <h2 className="text-lg font-medium">Partijos pakuotės</h2>
        {batch.bags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{EMPTY_BAGS_MESSAGE}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Barkodas</th>
                  <th className="px-4 py-2 font-medium">Vieta</th>
                  <th className="px-4 py-2 font-medium">Svoris</th>
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
                    <td className="px-4 py-2">{formatWeight(bag.netWeight)}</td>
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
                        disabled={bag.status === "VOIDED"}
                        aria-label={
                          bag.status === "VOIDED"
                            ? "Anuliuotos pakuotės etiketės spausdinti negalima"
                            : "Etiketė"
                        }
                        onClick={() => {
                          if (bag.status !== "VOIDED") {
                            setLabelBag(bag);
                          }
                        }}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
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
          <BagLabel
            label={bagLabelData({ code: batch.deliveryCode }, batch, labelBag)}
          />
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

      {showDiscrepancyDialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discrepancy-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <h2 id="discrepancy-dialog-title" className="text-lg font-medium">
              Patvirtinti priėmimą su neatitikimu?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Faktinis ir dokumentinis svoris nesutampa. Neatitikimas:{" "}
              {liveDifference ?? "—"}. Priėmimas bus patvirtintas, o neatitikimas
              užregistruotas atskirai.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDiscrepancyDialog(false)}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                Ne
              </button>
              <button
                type="button"
                onClick={() => void reconcileWith(true)}
                disabled={reconciling}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {reconciling ? "Tvirtinama…" : "Taip, patvirtinti"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** A read-only `<dt>`/`<dd>` pair for the PIECE batch context/confirmation. */
function ContextField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground">{value}</dd>
    </div>
  );
}
