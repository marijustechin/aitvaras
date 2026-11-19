import type { Batch, BatchDetail } from "@aitvaras/contracts";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";

/** Financial/documentary fields are manager-only. */
function isAdmin(actor: AuthenticatedUser): boolean {
  return actor.roles.includes("ADMIN");
}

/**
 * Remove financial/documentary fields from a batch for non-manager readers.
 * Warehouse workers still receive the operational batch shape (resource,
 * warehouse, status, totals, barcodes, locations).
 */
export function redactBatch<T extends Batch>(batch: T, actor: AuthenticatedUser): T {
  if (isAdmin(actor)) {
    return batch;
  }
  return {
    ...batch,
    documentWeight: null,
    documentPieces: null,
    difference: null,
    acquisitionAmount: null,
    documentDate: null,
    documentNumber: null,
  };
}

/** Redact a batch detail, including its per-product documentary comparison. */
export function redactBatchDetail(
  batch: BatchDetail,
  actor: AuthenticatedUser,
): BatchDetail {
  if (isAdmin(actor)) {
    return batch;
  }
  return {
    ...redactBatch(batch, actor),
    pieceReconciliation: batch.pieceReconciliation.map((row) => ({
      ...row,
      documentPieces: null,
      differencePieces: null,
    })),
  };
}
