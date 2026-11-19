"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  BatchDetail,
  BatchPieceConfirmation,
  BatchReconciliation,
  IncomingDeliveryDetail,
} from "@aitvaras/contracts";
import {
  formatArrivalDate,
  formatBatchDateTime,
  formatPieces,
  formatSignedPieces,
  formatWeight,
  formatWeightDifference,
  isBatchConfirmed,
  weightsMatch,
} from "@/entities/batch";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { formatMoney } from "@/shared/lib/format";
import { isoDatePart } from "@/shared/lib/date";
import { focusField } from "@/shared/lib/form-feedback";
import {
  DateInput,
  OUTLINE_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_NAV_BUTTON_CLASS,
  useToast,
} from "@/shared/ui";
import {
  createDraftPieceConfirmation,
  createDraftReconciliation,
  defaultPieceDocumentaryMode,
  isAcquisitionAmountValid,
  isDocumentaryWeightValid,
  isPieceCountValid,
  pieceConfirmationDifference,
  pieceConfirmationFormError,
  pieceRowDifference,
  pieceRowDraftValue,
  reconciliationFormError,
  toConfirmPiecePayload,
  toReconcilePayload,
  type DraftPieceConfirmation,
  type DraftReconciliation,
  type PieceConfirmationRow,
  type PieceDocumentaryMode,
} from "../lib/batch-form";
import { DeliveryExpensesBlock } from "./delivery-expenses";

const inputClass =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const invalidInputClass = inputClass.replace(
  "border-input",
  "border-destructive focus-visible:ring-destructive",
);

/** Use the shared manager input style, with a red border when a required value is invalid. */
function managerInputClass(invalid: boolean, extra = ""): string {
  return `${invalid ? invalidInputClass : inputClass} ${extra}`.trim();
}

const BATCH_GRID_CLASS =
  "md:grid md:grid-cols-[4rem_minmax(9rem,1fr)_6rem_8rem_5rem_8rem_minmax(11rem,auto)] md:items-start md:gap-3";

const TOGGLE_BUTTON_CLASS = `${OUTLINE_BUTTON_CLASS} whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 transition-transform ${
        expanded ? "rotate-180" : ""
      }`}
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

interface RowDraft {
  expanded: boolean;
  weight?: DraftReconciliation;
  piece?: DraftPieceConfirmation;
}

/** A per-product row for the manager screen. */
function pieceRowsOf(batch: BatchDetail): PieceConfirmationRow[] {
  return batch.pieceReconciliation.map((row) => ({
    resourceId: row.resourceId,
    resourceName: row.resourceName,
    actualPieces: row.actualPieces,
  }));
}

function initialDraft(batch: BatchDetail): RowDraft {
  if (batch.receivingMode === "PIECE") {
    const rows = pieceRowsOf(batch);
    return {
      expanded: false,
      piece: {
        ...createDraftPieceConfirmation(defaultPieceDocumentaryMode(rows)),
        documentPieces:
          batch.documentPieces === null ? "" : String(batch.documentPieces),
        products: Object.fromEntries(
          batch.pieceReconciliation
            .filter((row) => row.documentPieces !== null)
            .map((row) => [row.resourceId, String(row.documentPieces)]),
        ),
        acquisitionAmount: batch.acquisitionAmount ?? "",
        documentDate: batch.documentDate ? isoDatePart(batch.documentDate) : "",
        documentNumber: batch.documentNumber ?? "",
      },
    };
  }
  return {
    expanded: false,
    weight: {
      ...createDraftReconciliation(),
      documentWeight: batch.documentWeight ?? "",
      acquisitionAmount: batch.acquisitionAmount ?? "",
      documentDate: batch.documentDate ? isoDatePart(batch.documentDate) : "",
      documentNumber: batch.documentNumber ?? "",
    },
  };
}

function isDocumentedEmpty(value: string): boolean {
  return value.trim() === "";
}

/**
 * Manager receipt screen: one row per batch with inline documentary/acquisition
 * entry and per-batch confirmation. The receipt-level expense block sits below
 * the table. Warehouse workers do not use this screen.
 */
export function ReceiptManagerPage() {
  const params = useParams();
  const deliveryId =
    typeof params.deliveryId === "string" ? params.deliveryId : "";
  const router = useRouter();
  const { clearSession } = useAuth();
  const toast = useToast();

  const [delivery, setDelivery] = useState<IncomingDeliveryDetail | null>(null);
  const [details, setDetails] = useState<Record<string, BatchDetail>>({});
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    batch: BatchDetail;
    difference: string;
    acknowledge: boolean;
    lines?: { label: string; difference: string }[];
  } | null>(null);

  const handleError = useCallback(
    (caught: unknown, fallback: string): void => {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setLoadError("Priėmimas nerastas.");
        return;
      }
      toast.error(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router, toast],
  );

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const detail = await apiFetch<IncomingDeliveryDetail>(
        `/deliveries/${deliveryId}`,
      );
      const batchDetails = await Promise.all(
        detail.batches.map((batch) =>
          apiFetch<BatchDetail>(`/batches/${batch.id}`),
        ),
      );
      setDelivery(detail);
      setDetails(
        Object.fromEntries(batchDetails.map((batch) => [batch.id, batch])),
      );
      setDrafts((current) =>
        Object.fromEntries(
          batchDetails.map((batch) => [
            batch.id,
            current[batch.id] ?? initialDraft(batch),
          ]),
        ),
      );
      setLoadError(null);
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti priėmimo");
    } finally {
      setLoading(false);
    }
  }, [deliveryId, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(batchId: string, patch: Partial<RowDraft>): void {
    setDrafts((current) => ({
      ...current,
      [batchId]: { ...current[batchId]!, ...patch },
    }));
  }

  function updateWeight(
    batchId: string,
    patch: Partial<DraftReconciliation>,
  ): void {
    setDrafts((current) => ({
      ...current,
      [batchId]: {
        ...current[batchId]!,
        weight: { ...current[batchId]!.weight!, ...patch },
      },
    }));
  }

  function updatePiece(
    batchId: string,
    patch: Partial<DraftPieceConfirmation>,
  ): void {
    setDrafts((current) => ({
      ...current,
      [batchId]: {
        ...current[batchId]!,
        piece: { ...current[batchId]!.piece!, ...patch },
      },
    }));
  }

  function differenceFor(batch: BatchDetail): string | null {
    const draft = drafts[batch.id];
    if (!draft) {
      return null;
    }
    if (batch.receivingMode === "PIECE") {
      const piece = draft.piece!;
      if (piece.mode === "TOTAL") {
        const difference = pieceConfirmationDifference(
          batch.totalPieces,
          piece,
        );
        return difference === null ? null : formatSignedPieces(difference);
      }
      const rows = pieceRowsOf(batch);
      if (
        rows.some((row) => pieceRowDifference(piece, row) === null)
      ) {
        return null;
      }
      const total = rows.reduce(
        (sum, row) => sum + Number(pieceRowDraftValue(piece, row)),
        0,
      );
      return formatSignedPieces(batch.totalPieces - total);
    }
    const weight = draft.weight!;
    if (isDocumentedEmpty(weight.documentWeight)) {
      return null;
    }
    return formatWeightDifference(
      batch.totalNetWeight,
      weight.documentWeight,
    );
  }

  function documentedFor(batch: BatchDetail): string {
    if (batch.status === "CONFIRMED") {
      if (batch.receivingMode === "PIECE") {
        return batch.documentPieces === null
          ? "—"
          : formatPieces(batch.documentPieces);
      }
      return batch.documentWeight === null
        ? "—"
        : formatWeight(batch.documentWeight);
    }
    return "";
  }

  async function confirmWeight(
    batch: BatchDetail,
    acknowledge: boolean,
  ): Promise<void> {
    const draft = drafts[batch.id]?.weight;
    if (!draft) return;
    setConfirmingId(batch.id);
    try {
      await apiFetch<BatchReconciliation>(`/batches/${batch.id}/reconcile`, {
        method: "POST",
        body: JSON.stringify({
          ...toReconcilePayload(draft),
          ...(acknowledge ? { acknowledgeDiscrepancy: true } : {}),
        }),
      });
      setDialog(null);
      toast.success("Partija patvirtinta.");
      await load();
    } catch (caught) {
      setDialog(null);
      handleError(caught, "Nepavyko patvirtinti partijos");
    } finally {
      setConfirmingId(null);
    }
  }

  async function confirmPiece(
    batch: BatchDetail,
    acknowledge: boolean,
  ): Promise<void> {
    const draft = drafts[batch.id]?.piece;
    if (!draft) return;
    setConfirmingId(batch.id);
    try {
      await apiFetch<BatchPieceConfirmation>(
        `/batches/${batch.id}/confirm-piece`,
        {
          method: "POST",
          body: JSON.stringify(
            toConfirmPiecePayload(draft, pieceRowsOf(batch), acknowledge),
          ),
        },
      );
      setDialog(null);
      toast.success("Partija patvirtinta.");
      await load();
    } catch (caught) {
      setDialog(null);
      handleError(caught, "Nepavyko patvirtinti partijos");
    } finally {
      setConfirmingId(null);
    }
  }

  function confirmBatch(batch: BatchDetail): void {
    const draft = drafts[batch.id];
    if (!draft) return;
    if (batch.receivingMode === "PIECE") {
      const piece = draft.piece!;
      const rows = pieceRowsOf(batch);
      const validation = pieceConfirmationFormError(piece, rows);
      if (validation) {
        toast.error(validation);
        return;
      }
      if (piece.mode === "TOTAL") {
        const difference = pieceConfirmationDifference(
          batch.totalPieces,
          piece,
        );
        if (difference !== null && difference !== 0) {
          setDialog({
            batch,
            difference: formatSignedPieces(difference),
            acknowledge: true,
          });
          return;
        }
        void confirmPiece(batch, false);
        return;
      }
      const mismatchRows = rows
        .map((row) => ({
          label: row.resourceName,
          difference: pieceRowDifference(piece, row),
        }))
        .filter(
          (line): line is { label: string; difference: number } =>
            line.difference !== null && line.difference !== 0,
        )
        .map((line) => ({
          label: line.label,
          difference: formatSignedPieces(line.difference),
        }));
      if (mismatchRows.length > 0) {
        setDialog({
          batch,
          difference: differenceFor(batch) ?? "—",
          acknowledge: true,
          lines: mismatchRows,
        });
        return;
      }
      void confirmPiece(batch, false);
      return;
    }
    const weight = draft.weight!;
    const validation = reconciliationFormError(weight);
    if (validation) {
      toast.error(validation);
      focusField(
        weight.documentWeight.trim() === ""
          ? `manager-doc-${batch.id}`
          : `manager-acq-${batch.id}`,
      );
      return;
    }
    if (!weightsMatch(weight.documentWeight, batch.totalNetWeight)) {
      setDialog({
        batch,
        difference: differenceFor(batch) ?? "—",
        acknowledge: true,
      });
      return;
    }
    void confirmWeight(batch, false);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (loadError || !delivery) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {loadError ?? "Priėmimas nerastas."}
        </p>
        <Link href="/receipts" className={SECONDARY_NAV_BUTTON_CLASS}>
          ← Priėmimų sąrašas
        </Link>
      </div>
    );
  }

  const batches = delivery.batches;
  const hasPending = batches.some((batch) => batch.status === "PENDING");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Link href="/receipts" className={SECONDARY_NAV_BUTTON_CLASS}>
            ← Priėmimų sąrašas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Priėmimas {delivery.code}
          </h1>
        </div>
      </div>

      <section className="rounded-xl border border-border p-4">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium">Tiekėjas</dt>
            <dd className="text-sm text-muted-foreground">
              {delivery.supplierName}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium">Atvykimo data</dt>
            <dd className="text-sm text-muted-foreground">
              {formatArrivalDate(delivery.arrivalDate)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Priėmimo partijos</h2>
        <div
          aria-hidden="true"
          className={`hidden border-x border-transparent px-4 text-xs font-medium text-muted-foreground md:grid ${BATCH_GRID_CLASS}`}
        >
          <span>Partija</span>
          <span>Prekė</span>
          <span>Priimta</span>
          <span>Dokumentuose</span>
          <span>Skirtumas</span>
          <span>Įsigijimo vertė, €</span>
          <span>Būsena / veiksmas</span>
        </div>
        <div className="flex flex-col gap-3">
          {batches.map((summary) => {
            const batch = details[summary.id];
            const draft = drafts[summary.id];
            if (!batch || !draft) return null;
            const confirmed = isBatchConfirmed(batch.status);
            const piece = draft.piece;
            const weight = draft.weight;
            const actual =
              batch.receivingMode === "WEIGHT"
                ? formatWeight(batch.totalNetWeight)
                : formatPieces(batch.totalPieces);
            const product =
              batch.receivingMode === "WEIGHT"
                ? (batch.resourceName ?? "—")
                : batch.itemLineCount > 1
                  ? `${batch.itemLineCount} prekės`
                  : (batch.items.find((item) => item.status === "ACTIVE")
                      ?.resourceName ?? "—");
            const difference = differenceFor(batch);
            const documented = documentedFor(batch);
            return (
              <BatchRow
                key={batch.id}
                batch={batch}
                draft={draft}
                piece={piece}
                weight={weight}
                confirmed={confirmed}
                actual={actual}
                product={product}
                difference={difference}
                documented={documented}
                confirming={confirmingId === batch.id}
                onToggle={() =>
                  updateDraft(batch.id, {
                    expanded: !draft.expanded,
                  })
                }
                onUpdateWeight={(patch) => updateWeight(batch.id, patch)}
                onUpdatePiece={(patch) => updatePiece(batch.id, patch)}
                onConfirm={() => confirmBatch(batch)}
              />
            );
          })}
        </div>
        {!hasPending ? (
          <p className="text-sm text-muted-foreground">
            Visos partijos patvirtintos.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border p-4">
        <DeliveryExpensesBlock
          deliveryId={delivery.id}
          deliveryCode={delivery.code}
          batches={delivery.batches}
          onApplied={() => void load()}
        />
      </section>

      {dialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="manager-discrepancy-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 id="manager-discrepancy-title" className="text-lg font-medium">
              Patvirtinti {dialog.batch.code} su neatitikimu?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Partija {dialog.batch.code} bus patvirtinta, o neatitikimas
              užregistruotas atskirai.
            </p>
            {dialog.lines ? (
              <ul className="mt-3 grid gap-1 text-sm">
                {dialog.lines.map((line) => (
                  <li key={line.label}>
                    {line.label}:{" "}
                    <span className="font-medium text-destructive">
                      {line.difference}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Neatitikimas:{" "}
                <span className="font-medium text-destructive">
                  {dialog.difference}
                </span>
                .
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className={SECONDARY_NAV_BUTTON_CLASS}
              >
                Atšaukti
              </button>
              <button
                type="button"
                onClick={() =>
                  void (dialog.batch.receivingMode === "PIECE"
                    ? confirmPiece(dialog.batch, true)
                    : confirmWeight(dialog.batch, true))
                }
                disabled={confirmingId === dialog.batch.id}
                className={PRIMARY_BUTTON_CLASS}
              >
                {confirmingId === dialog.batch.id
                  ? `Tvirtinama ${dialog.batch.code}…`
                  : `Taip, patvirtinti ${dialog.batch.code}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


/** One batch group: compact summary plus its expandable documentary details. */
function BatchRow({
  batch,
  draft,
  piece,
  weight,
  confirmed,
  actual,
  product,
  difference,
  documented,
  confirming,
  onToggle,
  onUpdateWeight,
  onUpdatePiece,
  onConfirm,
}: {
  batch: BatchDetail;
  draft: RowDraft;
  piece?: DraftPieceConfirmation;
  weight?: DraftReconciliation;
  confirmed: boolean;
  actual: string;
  product: string;
  difference: string | null;
  documented: string;
  confirming: boolean;
  onToggle: () => void;
  onUpdateWeight: (patch: Partial<DraftReconciliation>) => void;
  onUpdatePiece: (patch: Partial<DraftPieceConfirmation>) => void;
  onConfirm: () => void;
}) {
  const rows = pieceRowsOf(batch);
  const itemisedDocumented =
    piece?.mode === "ITEMISED" &&
    rows.every((row) =>
      isPieceCountValid(pieceRowDraftValue(piece, row)),
    )
      ? rows.reduce(
          (sum, row) => sum + Number(pieceRowDraftValue(piece, row)),
          0,
        )
      : null;
  const inlineDocumented =
    batch.receivingMode === "WEIGHT"
      ? (weight?.documentWeight ?? "")
      : piece?.mode === "TOTAL"
        ? (piece?.documentPieces ?? "")
        : itemisedDocumented === null
          ? ""
          : String(itemisedDocumented);
  const acquisition =
    batch.receivingMode === "WEIGHT"
      ? (weight?.acquisitionAmount ?? "")
      : (piece?.acquisitionAmount ?? "");
  const expanded = draft.expanded;
  const hasProductToggle =
    batch.receivingMode === "PIECE" && batch.itemLineCount > 1;
  const panelId = `batch-panel-${batch.id}`;
  const toggleLabel = hasProductToggle
    ? expanded
      ? "Slėpti prekes"
      : "Rodyti prekes"
    : expanded
      ? "Slėpti detales"
      : "Dokumento duomenys";
  const confirmLabel = `Patvirtinti ${batch.code}`;
  const showRequired = expanded && !confirmed;
  const weightDocumentInvalid =
    showRequired &&
    batch.receivingMode === "WEIGHT" &&
    !isDocumentaryWeightValid(weight?.documentWeight ?? "");
  const acquisitionInvalid =
    showRequired && !isAcquisitionAmountValid(acquisition);
  const totalPiecesInvalid =
    showRequired &&
    batch.receivingMode === "PIECE" &&
    piece?.mode === "TOTAL" &&
    !isPieceCountValid(piece?.documentPieces ?? "");
  const summaryDocumentInvalid =
    batch.receivingMode === "WEIGHT"
      ? weightDocumentInvalid
      : totalPiecesInvalid;

  return (
    <section
      data-batch-code={batch.code}
      aria-labelledby={`batch-title-${batch.id}`}
      className={`rounded-xl border ${
        expanded ? "border-foreground/25 bg-muted/20" : "border-border bg-card"
      }`}
    >
      <div
        className={`grid grid-cols-2 gap-3 px-4 py-3 text-sm ${BATCH_GRID_CLASS}`}
      >
        <div>
          <p className="text-xs text-muted-foreground md:hidden">Partija</p>
          <h3 id={`batch-title-${batch.id}`} className="font-medium">
            {batch.code}
          </h3>
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="text-xs text-muted-foreground md:hidden">Prekė</p>
          <div>{product}</div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className={`${TOGGLE_BUTTON_CLASS} mt-2`}
          >
            {toggleLabel}
            <ChevronIcon expanded={expanded} />
          </button>
        </div>
        <div>
          <p className="text-xs text-muted-foreground md:hidden">Priimta</p>
          <p className="whitespace-nowrap">{actual}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground md:hidden">
            Dokumentuose
          </p>
          {confirmed ? (
            documented
          ) : batch.receivingMode === "PIECE" && piece?.mode === "ITEMISED" ? (
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Pagal prekes</span>
              <span>
                {inlineDocumented === ""
                  ? "—"
                  : formatPieces(Number(inlineDocumented))}
              </span>
            </div>
          ) : (
            <input
              id={`manager-doc-${batch.id}`}
              aria-label={`Dokumentuose ${batch.code}`}
              aria-required="true"
              aria-invalid={summaryDocumentInvalid}
              type="number"
              inputMode={batch.receivingMode === "PIECE" ? "numeric" : "decimal"}
              min="0"
              step={batch.receivingMode === "PIECE" ? "1" : "0.001"}
              value={inlineDocumented}
              onChange={(event) => {
                if (batch.receivingMode === "WEIGHT") {
                  onUpdateWeight({ documentWeight: event.target.value });
                } else {
                  onUpdatePiece({ documentPieces: event.target.value });
                }
              }}
              className={managerInputClass(summaryDocumentInvalid, "w-28")}
            />
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground md:hidden">Skirtumas</p>
          <p className="whitespace-nowrap">{difference ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground md:hidden">
            Įsigijimo vertė, €
          </p>
          {confirmed ? (
            batch.acquisitionAmount
              ? formatMoney(batch.acquisitionAmount)
              : "—"
          ) : (
            <input
              id={`manager-acq-${batch.id}`}
              aria-label={`Įsigijimo vertė ${batch.code}`}
              aria-required="true"
              aria-invalid={acquisitionInvalid}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={acquisition}
              onChange={(event) => {
                if (batch.receivingMode === "WEIGHT") {
                  onUpdateWeight({ acquisitionAmount: event.target.value });
                } else {
                  onUpdatePiece({ acquisitionAmount: event.target.value });
                }
              }}
              className={managerInputClass(acquisitionInvalid, "w-28")}
            />
          )}
        </div>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 md:col-span-1 md:justify-end">
          {confirmed ? (
            <div className="flex flex-col gap-1">
              <span className="text-emerald-500">Patvirtinta</span>
              {batch.confirmedAt ? (
                <span className="text-xs text-muted-foreground">
                  {formatBatchDateTime(batch.confirmedAt)}
                </span>
              ) : null}
            </div>
          ) : !expanded ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              aria-label={`Patvirtinti partiją ${batch.code}`}
              className={`${PRIMARY_BUTTON_CLASS} whitespace-nowrap`}
            >
              {confirming ? `Tvirtinama ${batch.code}…` : confirmLabel}
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div
          id={panelId}
          className="border-t border-border bg-muted/30 px-4 py-4"
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Dokumento data</span>
                <DateInput
                  id={`manager-date-${batch.id}`}
                  value={
                    batch.receivingMode === "WEIGHT"
                      ? (weight?.documentDate ?? "")
                      : (piece?.documentDate ?? "")
                  }
                  onChange={(documentDate) =>
                    batch.receivingMode === "WEIGHT"
                      ? onUpdateWeight({ documentDate })
                      : onUpdatePiece({ documentDate })
                  }
                  disabled={confirmed}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Dokumento Nr.</span>
                <input
                  id={`manager-number-${batch.id}`}
                  type="text"
                  maxLength={64}
                  value={
                    batch.receivingMode === "WEIGHT"
                      ? (weight?.documentNumber ?? "")
                      : (piece?.documentNumber ?? "")
                  }
                  onChange={(event) =>
                    batch.receivingMode === "WEIGHT"
                      ? onUpdateWeight({ documentNumber: event.target.value })
                      : onUpdatePiece({ documentNumber: event.target.value })
                  }
                  disabled={confirmed}
                  className={inputClass}
                />
              </label>
            </div>

            {batch.receivingMode === "PIECE" ? (
              <div className="grid gap-3">
                <fieldset className="flex flex-wrap items-center gap-4">
                  <legend className="mb-1 text-sm font-medium">
                    Dokumento forma
                  </legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`manager-mode-${batch.id}`}
                      checked={piece?.mode === "ITEMISED"}
                      onChange={() =>
                        onUpdatePiece({
                          mode: "ITEMISED" as PieceDocumentaryMode,
                        })
                      }
                      disabled={confirmed}
                    />
                    Pagal prekes
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`manager-mode-${batch.id}`}
                      checked={piece?.mode === "TOTAL"}
                      onChange={() =>
                        onUpdatePiece({
                          mode: "TOTAL" as PieceDocumentaryMode,
                        })
                      }
                      disabled={confirmed}
                    />
                    Bendras kiekis
                  </label>
                </fieldset>

                <div className="grid gap-2">
                  <h4 className="text-sm font-medium">{batch.code} prekės</h4>
                  {piece?.mode === "ITEMISED" ? (
                    <div className="overflow-x-auto rounded-lg border border-border bg-background">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 font-medium">Prekė</th>
                            <th className="px-4 py-2 font-medium">Faktiškai</th>
                            <th className="px-4 py-2 font-medium">
                              Dokumentuose
                            </th>
                            <th className="px-4 py-2 font-medium">Skirtumas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const line = batch.pieceReconciliation.find(
                              (entry) => entry.resourceId === row.resourceId,
                            );
                            const value = piece
                              ? pieceRowDraftValue(piece, row)
                              : "";
                            const rowDifference = piece
                              ? pieceRowDifference(piece, row)
                              : null;
                            const rowInvalid =
                              showRequired && !isPieceCountValid(value);
                            return (
                              <tr
                                key={row.resourceId}
                                className="border-t border-border"
                              >
                                <td className="px-4 py-2">{row.resourceName}</td>
                                <td className="px-4 py-2">
                                  {formatPieces(row.actualPieces)}
                                </td>
                                <td className="px-4 py-2">
                                  {confirmed ? (
                                    line?.documentPieces === null ||
                                    line?.documentPieces === undefined ? (
                                      "—"
                                    ) : (
                                      formatPieces(line.documentPieces)
                                    )
                                  ) : (
                                    <input
                                      id={`manager-item-${batch.id}-${row.resourceId}`}
                                      aria-label={`${batch.code} ${row.resourceName} dokumentuose`}
                                      aria-required="true"
                                      aria-invalid={rowInvalid}
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      step="1"
                                      value={value}
                                      onChange={(event) =>
                                        onUpdatePiece({
                                          products: {
                                            ...(piece?.products ?? {}),
                                            [row.resourceId]: event.target.value,
                                          },
                                        })
                                      }
                                      className={managerInputClass(rowInvalid, "w-24")}
                                    />
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {rowDifference === null
                                    ? "—"
                                    : formatSignedPieces(rowDifference)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!confirmed ? (
              <div className="flex flex-wrap justify-end border-t border-border pt-3">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={confirming}
                  aria-label={`Patvirtinti partiją ${batch.code}`}
                  className={`${PRIMARY_BUTTON_CLASS} whitespace-nowrap`}
                >
                  {confirming ? `Tvirtinama ${batch.code}…` : confirmLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
