import { Ean13Barcode } from "@/shared/ui";
import { formatPieces } from "@/entities/batch";
import type { PieceLabelData } from "../lib/receiving";

/**
 * Printable PIECE inventory-group label. The delivery code + batch code are the
 * human-facing references; the quantity is the counted piece total; the barcode
 * (with its graphic) is the only machine value and identifies this counted group
 * (not one individual piece).
 */
export function PieceLabel({ label }: { label: PieceLabelData }) {
  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Etiketė
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Priėmimas</dt>
        <dd className="font-medium">{label.deliveryCode}</dd>
        <dt className="text-muted-foreground">Partija</dt>
        <dd className="font-medium">{label.batchCode}</dd>
        <dt className="text-muted-foreground">Prekė</dt>
        <dd className="font-medium">{label.resourceName}</dd>
        <dt className="text-muted-foreground">Kiekis</dt>
        <dd className="font-semibold">{formatPieces(label.quantity)}</dd>
        <dt className="text-muted-foreground">Sandėlis</dt>
        <dd>{label.warehouseName}</dd>
        <dt className="text-muted-foreground">Vieta</dt>
        <dd>{label.locationName}</dd>
      </dl>
      <div className="mt-3">
        <Ean13Barcode value={label.barcode} />
      </div>
      <p className="mt-1 font-mono text-sm tracking-widest">{label.barcode}</p>
    </div>
  );
}
