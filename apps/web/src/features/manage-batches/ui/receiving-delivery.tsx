"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type Bag,
  type Batch,
  type BatchDetail,
  type IncomingDeliveryDetail,
  type PackagingType,
  type Resource,
  type WarehouseWithLocations,
} from "@aitvaras/contracts";
import {
  bagStatusClass,
  bagStatusLabel,
  batchStatusLabel,
  formatArrivalDate,
  formatBatchDateTime,
  formatWeight,
} from "@/entities/batch";
import {
  activePackagingTypes,
  findPackagingType,
} from "@/entities/packaging-type";
import { activeResources } from "@/entities/resource";
import {
  activeWarehouses,
  locationsForWarehouse,
} from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  DESTRUCTIVE_BUTTON_CLASS,
  OUTLINE_BUTTON_CLASS,
  PlusIcon,
  PRIMARY_BUTTON_CLASS,
  PrinterIcon,
  SECONDARY_BUTTON_CLASS,
  SaveIcon,
} from "@/shared/ui";
import {
  bagFormError,
  correctionChanged,
  correctionDraftFromBag,
  correctionFormError,
  resourceFormError,
  toCreateBagPayload,
  toResolveBatchPayload,
  toUpdateBagPayload,
  toVoidBagPayload,
  type DraftBag,
  type DraftCorrection,
} from "../lib/batch-form";
import { batchStatusClass } from "../lib/batch-list";
import {
  activeBatchUnits,
  ANOTHER_RESOURCE_LABEL,
  applyUnitSaveFailed,
  applyUnitSaved,
  applyUnitSavedSilently,
  bagLabelData,
  batchUnitRow,
  BATCH_UNITS_HEADING,
  CANCEL_LABEL,
  closeLabel,
  CORRECT_LABEL,
  DELIVERIES_LIST_BACK_LABEL,
  DELIVERY_CONTENTS_HEADING,
  deliveryBatches,
  EMPTY_BATCH_UNITS_MESSAGE,
  EMPTY_DELIVERY_CONTENTS_MESSAGE,
  enterBatch,
  enterDelivery,
  initialReceivingState,
  openLabel,
  REPRINT_LABEL,
  RESOURCE_HEADING,
  SAVE_AND_PRINT_LABEL,
  SAVE_CORRECTION_LABEL,
  SAVE_LABEL,
  START_RESOURCE_LABEL,
  startAnotherResource,
  VOID_CONFIRM_LABEL,
  VOID_LABEL,
  VOID_REASON_LABEL,
  VOIDED_UNITS_HEADING,
  voidedBatchUnits,
  type ReceivingState,
} from "../lib/receiving";
import { BagLabel } from "./bag-label";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** Client-side net weight display: gross − tare, or null when not computable. */
function netWeightOf(gross: string, tareWeightKg: string | null): string | null {
  if (tareWeightKg === null || gross.trim() === "") {
    return null;
  }
  const grossValue = Number(gross);
  if (!Number.isFinite(grossValue)) {
    return null;
  }
  const net = grossValue - Number(tareWeightKg);
  return Number.isFinite(net) ? String(net) : null;
}

/**
 * The selected-delivery receiving screen (`/receiving/[deliveryId]`).
 *
 * One `Gavimas` is one physical arrival of one supplier on one arrival date and
 * may contain several resources. Each batch is one resource into one warehouse.
 * Packages are received by weight: the worker selects `Tara`, `Vieta` and enters
 * only `Bruto svoris`; the server derives net weight (gross − tare).
 */
export function ReceivingDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const deliveryId =
    typeof params.deliveryId === "string" ? params.deliveryId : "";
  const { clearSession } = useAuth();

  const [resources, setResources] = useState<Resource[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[] | null>(
    null,
  );
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[] | null>(
    null,
  );
  const [state, setState] = useState<ReceivingState>(initialReceivingState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [submittingUnit, setSubmittingUnit] = useState<"save" | "print" | null>(
    null,
  );
  const [correction, setCorrection] = useState<DraftCorrection | null>(null);
  const [correctingUnit, setCorrectingUnit] = useState(false);
  const [voidingBag, setVoidingBag] = useState<Bag | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidingUnit, setVoidingUnit] = useState(false);
  const grossInputRef = useRef<HTMLInputElement>(null);
  const submitIntentRef = useRef<"save" | "print">("print");

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

  useEffect(() => {
    if (!deliveryId) {
      setLoading(false);
      return;
    }
    let active = true;
    async function load(): Promise<void> {
      try {
        const [resourceList, warehouseList, packagingList, detail] =
          await Promise.all([
            apiFetch<Resource[]>("/resources"),
            apiFetch<WarehouseWithLocations[]>("/warehouses"),
            apiFetch<PackagingType[]>("/packaging-types"),
            apiFetch<IncomingDeliveryDetail>(`/deliveries/${deliveryId}`),
          ]);
        if (!active) {
          return;
        }
        setResources(resourceList);
        setWarehouses(warehouseList);
        setPackagingTypes(packagingList);
        setState(enterDelivery(detail));
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti gavimo");
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
  }, [deliveryId, handleError]);

  const labelId = state.label?.id ?? null;

  // Invoke the browser print preview from the label surface after a save.
  useEffect(() => {
    if (!labelId) {
      return;
    }
    const timer = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(timer);
  }, [labelId]);

  // Return focus to the gross-weight field whenever the entry form is shown.
  useEffect(() => {
    if (state.batch && !labelId) {
      grossInputRef.current?.focus();
    }
  }, [state.batch, labelId]);

  function resetUnitEditing(): void {
    setCorrection(null);
    setVoidingBag(null);
    setVoidReason("");
  }

  function closeLabelSurface(): void {
    setState(closeLabel);
  }

  function reprintUnit(bagId: string): void {
    const bag = state.batch?.bags.find((item) => item.id === bagId);
    if (!bag) {
      return;
    }
    setState((current) => openLabel(current, bag));
  }

  function updateResource(patch: Partial<ReceivingState["resource"]>): void {
    setState((current) => ({
      ...current,
      resource: { ...current.resource, ...patch },
    }));
  }

  function updateDraft(patch: Partial<DraftBag>): void {
    setState((current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  }

  async function resolveResource(): Promise<void> {
    const delivery = state.delivery;
    if (!delivery) {
      return;
    }
    const validation = resourceFormError(state.resource);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    setResolving(true);
    setError(null);
    setNotice(null);
    try {
      const batch = await apiFetch<BatchDetail>(
        `/deliveries/${delivery.id}/batches`,
        {
          method: "POST",
          body: JSON.stringify(toResolveBatchPayload(state.resource)),
        },
      );
      setState((current) => {
        const base =
          current.delivery?.id === delivery.id ? current : enterDelivery(delivery);
        return enterBatch(base, batch);
      });
    } catch (caught) {
      handleError(caught, "Nepavyko pradėti ištekliaus");
    } finally {
      setResolving(false);
    }
  }

  function anotherResource(): void {
    resetUnitEditing();
    setState(startAnotherResource);
    setError(null);
    setNotice(null);
  }

  async function refreshBatchAndDelivery(): Promise<{
    batch: BatchDetail;
    delivery: IncomingDeliveryDetail;
  } | null> {
    const batch = state.batch;
    const delivery = state.delivery;
    if (!batch || !delivery) {
      return null;
    }
    const [freshBatch, freshDelivery] = await Promise.all([
      apiFetch<BatchDetail>(`/batches/${batch.id}`),
      apiFetch<IncomingDeliveryDetail>(`/deliveries/${delivery.id}`),
    ]);
    return { batch: freshBatch, delivery: freshDelivery };
  }

  async function submitBag(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const batch = state.batch;
    if (!batch) {
      return;
    }
    const validation = bagFormError(state.draft);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    const intent = submitIntentRef.current;
    setSubmittingUnit(intent);
    setError(null);
    setNotice(null);
    try {
      const created = await apiFetch<Bag>(`/batches/${batch.id}/bags`, {
        method: "POST",
        body: JSON.stringify(toCreateBagPayload(state.draft)),
      });
      const refreshed = await refreshBatchAndDelivery();
      if (!refreshed) {
        return;
      }
      setState((current) => {
        const withDelivery = { ...current, delivery: refreshed.delivery };
        return intent === "print"
          ? applyUnitSaved(withDelivery, refreshed.batch, created)
          : applyUnitSavedSilently(withDelivery, refreshed.batch);
      });
      setNotice(`Pakuotė išsaugota: ${created.barcode}`);
    } catch (caught) {
      setState(applyUnitSaveFailed);
      handleError(caught, "Nepavyko išsaugoti pakuotės");
    } finally {
      setSubmittingUnit(null);
    }
  }

  async function submitCorrection(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const bag = state.batch?.bags.find((item) => item.id === correction?.id);
    if (!bag || !correction) {
      return;
    }
    const validation = correctionFormError(correction);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    if (!correctionChanged(correction, bag)) {
      setCorrection(null);
      return;
    }
    setCorrectingUnit(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await apiFetch<Bag>(
        `/batches/${bag.batchId}/bags/${bag.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(toUpdateBagPayload(correction, bag)),
        },
      );
      const refreshed = await refreshBatchAndDelivery();
      if (refreshed) {
        setState((current) => ({
          ...current,
          batch: refreshed.batch,
          delivery: refreshed.delivery,
        }));
      }
      setCorrection(null);
      setNotice(`Pakuotė pataisyta: ${updated.barcode}`);
    } catch (caught) {
      handleError(caught, "Nepavyko pataisyti pakuotės");
    } finally {
      setCorrectingUnit(false);
    }
  }

  async function submitVoid(): Promise<void> {
    const bag = voidingBag;
    if (!bag) {
      return;
    }
    setVoidingUnit(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch<Bag>(`/batches/${bag.batchId}/bags/${bag.id}/void`, {
        method: "POST",
        body: JSON.stringify(toVoidBagPayload(voidReason)),
      });
      const refreshed = await refreshBatchAndDelivery();
      if (refreshed) {
        setState((current) => ({
          ...current,
          batch: refreshed.batch,
          delivery: refreshed.delivery,
        }));
      }
      setVoidingBag(null);
      setVoidReason("");
      setNotice(`Pakuotė anuliuota: ${bag.barcode}`);
    } catch (caught) {
      handleError(caught, "Nepavyko anuliuoti pakuotės");
    } finally {
      setVoidingUnit(false);
    }
  }

  const resourceOptions = resources ? activeResources(resources) : [];
  const warehouseOptions = warehouses ? activeWarehouses(warehouses) : [];
  const packagingOptions = packagingTypes
    ? activePackagingTypes(packagingTypes)
    : [];
  const delivery = state.delivery;
  const activeBatch = state.batch;
  const savedBag = state.label;
  const locationOptions =
    activeBatch && warehouses
      ? locationsForWarehouse(warehouses, activeBatch.warehouseId)
      : [];

  const draftTare =
    findPackagingType(packagingTypes ?? [], state.draft.packagingTypeId)
      ?.tareWeightKg ?? null;
  const draftNet = netWeightOf(state.draft.grossWeight, draftTare);

  const correctionBag = correction
    ? (state.batch?.bags.find((bag) => bag.id === correction.id) ?? null)
    : null;
  const correctionTare = correction
    ? correctionBag &&
      correction.packagingTypeId === correctionBag.packagingTypeId
      ? correctionBag.tareWeightKg
      : (findPackagingType(packagingTypes ?? [], correction.packagingTypeId)
          ?.tareWeightKg ?? null)
    : null;
  const correctionNet = correction
    ? netWeightOf(correction.grossWeight, correctionTare)
    : null;

  function updateCorrection(patch: Partial<DraftCorrection>): void {
    setCorrection((current) => (current ? { ...current, ...patch } : current));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/receiving" className={SECONDARY_BUTTON_CLASS}>
          {DELIVERIES_LIST_BACK_LABEL}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        {delivery ? `Gavimas ${delivery.code}` : "Gavimas"}
      </h1>

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

      {loading && !delivery ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : null}

      {!loading && !delivery ? (
        <p className="text-sm text-muted-foreground">Gavimas nerastas.</p>
      ) : null}

      {delivery && !savedBag ? (
        <section className={workSurfaceClass()}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">Gavimas {delivery.code}</h2>
            </div>

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

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-base font-medium">
                {DELIVERY_CONTENTS_HEADING}
              </h3>
              {deliveryBatches(delivery).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {EMPTY_DELIVERY_CONTENTS_MESSAGE}
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Išteklius</th>
                        <th className="px-4 py-2 font-medium">Sandėlis</th>
                        <th className="px-4 py-2 font-medium">Pakuotės</th>
                        <th className="px-4 py-2 font-medium">Neto svoris</th>
                        <th className="px-4 py-2 font-medium">Būsena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryBatches(delivery).map((batch) => (
                        <DeliveryBatchRow
                          key={batch.id}
                          batch={batch}
                          active={batch.id === activeBatch?.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid gap-3 border-t border-border pt-4">
              <h3 className="text-base font-medium">{RESOURCE_HEADING}</h3>
              {activeBatch ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">
                      {activeBatch.resourceName}
                    </span>{" "}
                    · {activeBatch.warehouseName}
                  </p>
                  <button
                    type="button"
                    onClick={anotherResource}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    <PlusIcon />
                    {ANOTHER_RESOURCE_LABEL}
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-12">
                  <label className="grid gap-1 text-sm sm:col-span-5">
                    <span className="font-medium">Išteklius</span>
                    <select
                      value={state.resource.resourceId}
                      onChange={(event) =>
                        updateResource({ resourceId: event.target.value })
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
                  <label className="grid gap-1 text-sm sm:col-span-4">
                    <span className="font-medium">Sandėlis</span>
                    <select
                      value={state.resource.warehouseId}
                      onChange={(event) =>
                        updateResource({ warehouseId: event.target.value })
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
                  <div className="flex items-end sm:col-span-3">
                    <button
                      type="button"
                      onClick={() => void resolveResource()}
                      disabled={resolving}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      {resolving ? "Pradedama…" : START_RESOURCE_LABEL}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {activeBatch ? (
              <form
                onSubmit={submitBag}
                className="grid gap-3 border-t border-border pt-4"
              >
                <h3 className="text-base font-medium">Nauja pakuotė</h3>
                <div className="grid gap-3 sm:grid-cols-12">
                  <label className="grid gap-1 text-sm sm:col-span-4">
                    <span className="font-medium">Tara</span>
                    <select
                      required
                      value={state.draft.packagingTypeId}
                      onChange={(event) =>
                        updateDraft({ packagingTypeId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">— Pasirinkti —</option>
                      {packagingOptions.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-4">
                    <span className="font-medium">Vieta</span>
                    <select
                      required
                      value={state.draft.warehouseLocationId}
                      onChange={(event) =>
                        updateDraft({ warehouseLocationId: event.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">— Pasirinkti —</option>
                      {locationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-4">
                    <span className="font-medium">Bruto svoris</span>
                    <input
                      ref={grossInputRef}
                      required
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      value={state.draft.grossWeight}
                      onChange={(event) =>
                        updateDraft({ grossWeight: event.target.value })
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Taros svoris:{" "}
                  {draftTare !== null ? formatWeight(draftTare) : "—"} · Neto
                  svoris: {draftNet !== null ? formatWeight(draftNet) : "—"}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={submittingUnit !== null}
                    onClick={() => {
                      submitIntentRef.current = "save";
                    }}
                    className={SECONDARY_BUTTON_CLASS}
                  >
                    <SaveIcon />
                    {submittingUnit === "save" ? "Saugoma…" : SAVE_LABEL}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUnit !== null}
                    onClick={() => {
                      submitIntentRef.current = "print";
                    }}
                    className={PRIMARY_BUTTON_CLASS}
                  >
                    <PrinterIcon />
                    {submittingUnit === "print"
                      ? "Saugoma…"
                      : SAVE_AND_PRINT_LABEL}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="flex items-center justify-start border-t border-border pt-4">
              <Link href="/receiving" className={SECONDARY_BUTTON_CLASS}>
                {DELIVERIES_LIST_BACK_LABEL}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {delivery && activeBatch && !savedBag ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{BATCH_UNITS_HEADING}</h2>
          {activeBatchUnits(activeBatch).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {EMPTY_BATCH_UNITS_MESSAGE}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Barkodas</th>
                    <th className="px-4 py-2 font-medium">Vieta</th>
                    <th className="px-4 py-2 font-medium">Neto svoris</th>
                    <th className="px-4 py-2 font-medium">Užregistruota</th>
                    <th className="px-4 py-2 font-medium">Veiksmai</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBatchUnits(activeBatch).map((bag) => {
                    const row = batchUnitRow(bag);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-2 font-mono">{row.barcode}</td>
                        <td className="px-4 py-2">{row.locationName}</td>
                        <td className="px-4 py-2">
                          {formatWeight(row.netWeight)}
                        </td>
                        <td className="px-4 py-2">
                          {formatBatchDateTime(row.registeredAt)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingBag(null);
                                setVoidReason("");
                                setCorrection(correctionDraftFromBag(bag));
                              }}
                              className={OUTLINE_BUTTON_CLASS}
                            >
                              {CORRECT_LABEL}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCorrection(null);
                                setVoidingBag(bag);
                                setVoidReason("");
                              }}
                              className={OUTLINE_BUTTON_CLASS}
                            >
                              {VOID_LABEL}
                            </button>
                            <button
                              type="button"
                              onClick={() => reprintUnit(row.id)}
                              className={OUTLINE_BUTTON_CLASS}
                            >
                              {REPRINT_LABEL}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {correction ? (
            <form
              onSubmit={submitCorrection}
              className="grid gap-3 rounded-xl border border-border p-4"
            >
              <h3 className="text-base font-medium">Koreguoti pakuotę</h3>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-4">
                  <span className="font-medium">Tara</span>
                  <select
                    value={correction.packagingTypeId}
                    onChange={(event) =>
                      updateCorrection({ packagingTypeId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">— Pasirinkti —</option>
                    {packagingOptions.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm sm:col-span-4">
                  <span className="font-medium">Vieta</span>
                  <select
                    value={correction.warehouseLocationId}
                    onChange={(event) =>
                      updateCorrection({
                        warehouseLocationId: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">— Pasirinkti —</option>
                    {locationOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm sm:col-span-4">
                  <span className="font-medium">Bruto svoris</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.001"
                    value={correction.grossWeight}
                    onChange={(event) =>
                      updateCorrection({ grossWeight: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground">
                Taros svoris:{" "}
                {correctionTare !== null ? formatWeight(correctionTare) : "—"} ·
                Neto svoris:{" "}
                {correctionNet !== null ? formatWeight(correctionNet) : "—"}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCorrection(null)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="submit"
                  disabled={correctingUnit}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {correctingUnit ? "Saugoma…" : SAVE_CORRECTION_LABEL}
                </button>
              </div>
            </form>
          ) : null}

          {voidingBag ? (
            <div className="grid gap-3 rounded-xl border border-destructive/40 p-4">
              <h3 className="text-base font-medium">
                Anuliuoti pakuotę {voidingBag.barcode}
              </h3>
              <p className="text-sm text-muted-foreground">
                Pakuotė bus pažymėta kaip anuliuota ir nebeįskaičiuojama į neto
                svorį. Duomenys išlieka.
              </p>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{VOID_REASON_LABEL}</span>
                <input
                  type="text"
                  maxLength={500}
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVoidingBag(null);
                    setVoidReason("");
                  }}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="button"
                  onClick={() => void submitVoid()}
                  disabled={voidingUnit}
                  className={DESTRUCTIVE_BUTTON_CLASS}
                >
                  {voidingUnit ? "Anuliuojama…" : VOID_CONFIRM_LABEL}
                </button>
              </div>
            </div>
          ) : null}

          {voidedBatchUnits(activeBatch).length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-medium">{VOIDED_UNITS_HEADING}</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Barkodas</th>
                      <th className="px-4 py-2 font-medium">Neto svoris</th>
                      <th className="px-4 py-2 font-medium">Būsena</th>
                      <th className="px-4 py-2 font-medium">Anuliavo</th>
                      <th className="px-4 py-2 font-medium">Priežastis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidedBatchUnits(activeBatch).map((bag) => (
                      <tr
                        key={bag.id}
                        className="border-t border-border text-muted-foreground"
                      >
                        <td className="px-4 py-2 font-mono">{bag.barcode}</td>
                        <td className="px-4 py-2">
                          {formatWeight(bag.netWeight)}
                        </td>
                        <td className="px-4 py-2">
                          <span className={bagStatusClass(bag.status)}>
                            {bagStatusLabel(bag.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {bag.voidedByName ?? "—"}
                          {bag.voidedAt
                            ? ` · ${formatBatchDateTime(bag.voidedAt)}`
                            : ""}
                        </td>
                        <td className="px-4 py-2">{bag.voidReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {delivery && activeBatch && savedBag ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Etiketė · Gavimas {delivery.code}
            </h2>
            <button
              type="button"
              onClick={closeLabelSurface}
              className={SECONDARY_BUTTON_CLASS}
            >
              Uždaryti
            </button>
          </div>
          <BagLabel label={bagLabelData(delivery, activeBatch, savedBag)} />
          <div>
            <button
              type="button"
              onClick={() => window.print()}
              className={PRIMARY_BUTTON_CLASS}
            >
              Spausdinti
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DeliveryBatchRow({
  batch,
  active,
}: {
  batch: Batch;
  active: boolean;
}) {
  return (
    <tr
      className={
        active ? "border-t border-border bg-accent/40" : "border-t border-border"
      }
    >
      <td className="px-4 py-2 font-medium">{batch.resourceName}</td>
      <td className="px-4 py-2">{batch.warehouseName}</td>
      <td className="px-4 py-2">{batch.bagCount}</td>
      <td className="px-4 py-2">{formatWeight(batch.totalNetWeight)}</td>
      <td className="px-4 py-2">
        <span className={batchStatusClass(batch.status)}>
          {batchStatusLabel(batch.status)}
        </span>
      </td>
    </tr>
  );
}
