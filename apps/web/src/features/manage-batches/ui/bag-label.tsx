import { formatWeight } from "@/entities/batch";
import { Ean13Barcode } from "@/shared/ui";
import type { BagLabelData } from "../lib/receiving";

/**
 * Printable package label. The delivery code (`Gavimas: GYYMM-NN`) is the
 * prominent human-facing reference and the **net weight** is the primary stock
 * quantity; gross/tare are shown as secondary traceability. The barcode (with its
 * graphic) is the only machine value and identifies the physical package.
 */
export function BagLabel({ label }: { label: BagLabelData }) {
  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Etiketė
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Gavimas</dt>
        <dd className="font-medium">{label.deliveryCode}</dd>
        <dt className="text-muted-foreground">Sandėlis</dt>
        <dd>{label.warehouseName}</dd>
        <dt className="text-muted-foreground">Vieta</dt>
        <dd>{label.locationName}</dd>
        <dt className="text-muted-foreground">Kategorija</dt>
        <dd>{label.categoryName}</dd>
        <dt className="text-muted-foreground">Rūšis</dt>
        <dd className="font-medium">{label.resourceName}</dd>
        <dt className="text-muted-foreground">Neto svoris</dt>
        <dd className="font-semibold">{formatWeight(label.netWeight)}</dd>
        <dt className="text-muted-foreground">Bruto svoris</dt>
        <dd>{formatWeight(label.grossWeight)}</dd>
        <dt className="text-muted-foreground">Taros svoris</dt>
        <dd>{formatWeight(label.tareWeightKg)}</dd>
      </dl>
      <div className="mt-3">
        <Ean13Barcode value={label.barcode} />
      </div>
      <p className="mt-1 font-mono text-sm tracking-widest">{label.barcode}</p>
    </div>
  );
}
