"use client";

import { useEffect, useState } from "react";
import type {
  BatchDetail,
  IncomingDeliveryDetail,
  Partner,
  Resource,
  UpdateBatchRegistrationRequest,
  WarehouseWithLocations,
} from "@aitvaras/contracts";
import { activeSuppliers } from "@/entities/partner";
import { ApiError, apiFetch } from "@/shared/api";
import { dateOnlyToLocalIso, isoDatePart } from "@/shared/lib/date";
import { focusField } from "@/shared/lib/form-feedback";
import { DateInput, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, useToast } from "@/shared/ui";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/**
 * Metadata editor for one PENDING batch and its receipt header.
 *
 * Unit-level changes (bags/items) use the existing registration controls below;
 * this form handles receipt supplier/date (shared scope) and batch resource/
 * warehouse. It never changes the batch status or creates another receipt.
 */
export function BatchRegistrationEditor({
  delivery,
  batch,
  partners,
  resources,
  warehouses,
  onSaved,
  onCancel,
  onConflict,
}: {
  delivery: IncomingDeliveryDetail;
  batch: BatchDetail;
  partners: readonly Partner[];
  resources: readonly Resource[];
  warehouses: readonly WarehouseWithLocations[];
  onSaved: (batch: BatchDetail) => void;
  onCancel: () => void;
  onConflict: () => void;
}) {
  const [supplierId, setSupplierId] = useState(delivery.supplierId);
  const [arrivalDate, setArrivalDate] = useState(isoDatePart(delivery.arrivalDate));
  const [resourceId, setResourceId] = useState(batch.resourceId ?? "");
  const [warehouseId, setWarehouseId] = useState(batch.warehouseId);
  const [relocationLocationId, setRelocationLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(batch.status !== "PENDING");
  const toast = useToast();

  const confirmedSibling = delivery.batches.some(
    (item) => item.id !== batch.id && item.status === "CONFIRMED",
  );
  const canEditReceipt = !confirmedSibling && !locked;
  const isWeight = batch.receivingMode === "WEIGHT";
  const hasActiveUnits = batch.bagCount > 0 || batch.itemLineCount > 0;
  const warehouseChanged = warehouseId !== batch.warehouseId;
  const targetWarehouse = warehouses.find(
    (warehouse) => warehouse.id === warehouseId,
  );
  const activeSupplierOptions = activeSuppliers(partners);
  const supplierOptions = activeSupplierOptions.some(
    (partner) => partner.id === delivery.supplierId,
  )
    ? activeSupplierOptions
    : [
        { id: delivery.supplierId, name: delivery.supplierName },
        ...activeSupplierOptions,
      ];

  const dirty =
    supplierId !== delivery.supplierId ||
    arrivalDate !== isoDatePart(delivery.arrivalDate) ||
    resourceId !== (batch.resourceId ?? "") ||
    warehouseId !== batch.warehouseId ||
    relocationLocationId !== "";

  useEffect(() => {
    if (!dirty || locked) {
      return;
    }
    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  async function save(): Promise<void> {
    if (!warehouseId) {
      toast.error("Pasirinkite sandėlį.");
      focusField("registration-warehouse");
      return;
    }
    if (warehouseChanged && hasActiveUnits && !relocationLocationId) {
      toast.error(
        "Pasirinkite naują sandėlio vietą visoms aktyvioms pakuotėms ir eilutėms.",
      );
      focusField("registration-relocation");
      return;
    }
    if (canEditReceipt && arrivalDate === "") {
      toast.error("Įveskite priėmimo datą.");
      focusField("registration-arrival-date");
      return;
    }

    const arrivalChanged =
      canEditReceipt && arrivalDate !== isoDatePart(delivery.arrivalDate);
    const arrivalIso = arrivalChanged ? dateOnlyToLocalIso(arrivalDate) : null;
    if (arrivalChanged && arrivalIso === null) {
      toast.error("Įveskite teisingą priėmimo datą.");
      focusField("registration-arrival-date");
      return;
    }

    const payload: UpdateBatchRegistrationRequest = {};
    if (canEditReceipt && supplierId !== delivery.supplierId) {
      payload.supplierId = supplierId;
    }
    if (arrivalIso) {
      payload.arrivalDate = arrivalIso;
    }
    if (isWeight && resourceId !== (batch.resourceId ?? "")) {
      payload.resourceId = resourceId || null;
    }
    if (warehouseChanged) {
      payload.warehouseId = warehouseId;
      if (hasActiveUnits) {
        payload.relocationLocationId = relocationLocationId;
      }
    }

    if (Object.keys(payload).length === 0) {
      toast.info("Pakeitimų nėra.");
      return;
    }

    setSaving(true);
    try {
      const updated = await apiFetch<BatchDetail>(
        `/batches/${batch.id}/registration`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      toast.success("Partijos pakeitimai išsaugoti.");
      onSaved(updated);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setLocked(true);
        toast.error(caught.message);
        onConflict();
        return;
      }
      const message =
        caught instanceof ApiError
          ? caught.message
          : "Nepavyko išsaugoti partijos pakeitimų.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">Redaguoti partiją</h2>
          <p className="text-sm text-muted-foreground">
            Pakeitimai išsaugomi nepatvirtintoje partijoje. Partija liks
            nepatvirtinta.
          </p>
        </div>
        {locked ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            Partija patvirtinta
          </span>
        ) : null}
      </div>

      <fieldset disabled={locked} className="grid gap-4">
        <div className="grid gap-3 border-b border-border pb-4">
          <div>
            <h3 className="text-sm font-medium">Priėmimo duomenys</h3>
            <p className="text-xs text-muted-foreground">
              {delivery.batches.length > 1
                ? `Tiekėjas ir data taikomi visam priėmimui (${delivery.batches.length} partijos).`
                : "Tiekėjas ir data taikomi visam priėmimui."}
            </p>
            {confirmedSibling ? (
              <p className="mt-1 text-xs text-destructive">
                Tiekėjo ir datos keisti negalima, nes priėmime jau yra patvirtinta
                partija.
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Tiekėjas</span>
              <select
                id="registration-supplier"
                value={supplierId}
                disabled={!canEditReceipt}
                onChange={(event) => {
                  setSupplierId(event.target.value);
                }}
                className={inputClass}
              >
                {supplierOptions.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Atvykimo data</span>
              <DateInput
                id="registration-arrival-date"
                value={arrivalDate}
                disabled={!canEditReceipt}
                onChange={(value) => {
                  setArrivalDate(value);
                }}
                required
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3">
          <h3 className="text-sm font-medium">Partijos duomenys</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {isWeight ? (
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Išteklius</span>
                <select
                  id="registration-resource"
                  value={resourceId}
                  onChange={(event) => {
                    setResourceId(event.target.value);
                  }}
                  className={inputClass}
                >
                  <option value="">— Pasirinkti —</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-1">
                Vienetinėje partijoje išteklius nurodomas kiekvienoje eilutėje.
              </p>
            )}
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Sandėlis</span>
              <select
                id="registration-warehouse"
                value={warehouseId}
                onChange={(event) => {
                  setWarehouseId(event.target.value);
                  setRelocationLocationId("");
                }}
                className={inputClass}
              >
                <option value="">— Pasirinkti —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            {warehouseChanged && hasActiveUnits ? (
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">
                  Nauja vieta visoms aktyvioms pakuotėms / eilutėms *
                </span>
                <select
                  id="registration-relocation"
                  value={relocationLocationId}
                  onChange={(event) => {
                    setRelocationLocationId(event.target.value);
                  }}
                  className={inputClass}
                >
                  <option value="">— Pasirinkti —</option>
                  {(targetWarehouse?.locations ?? [])
                    .filter((location) => location.active)
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Keičiant sandėlį, visos aktyvios pakuotės ir eilutės perkeliamos į
                  pasirinktą vietą.
                </span>
              </label>
            ) : null}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={SECONDARY_BUTTON_CLASS}
        >
          Atšaukti
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || locked}
          className={PRIMARY_BUTTON_CLASS}
        >
          {saving ? "Saugoma…" : "Išsaugoti pakeitimus"}
        </button>
      </div>
    </section>
  );
}
