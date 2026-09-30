"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  HANDLING_UNIT_KEYS,
  type Bag,
  type Batch,
  type BatchDetail,
  type Partner,
  type Resource,
  type WarehouseWithLocations,
} from "@aitvaras/contracts";
import {
  bagStatusClass,
  bagStatusLabel,
  batchStatusLabel,
  formatArrivalDate,
  formatBatchDateTime,
  formatQuantity,
  handlingUnitLabel,
  RECEIVE_ACTION,
} from "@/entities/batch";
import { activeSuppliers } from "@/entities/partner";
import { activeResources } from "@/entities/resource";
import {
  activeWarehouses,
  locationsForWarehouse,
} from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { PlusIcon, PrinterIcon, SaveIcon } from "@/shared/ui";
import {
  bagFormError,
  batchFormError,
  correctionChanged,
  correctionDraftFromBag,
  correctionFormError,
  createDraftBatch,
  toCreateBagPayload,
  toCreateBatchPayload,
  toUpdateBagPayload,
  toVoidBagPayload,
  type DraftBag,
  type DraftBatch,
  type DraftCorrection,
} from "../lib/batch-form";
import {
  activeBatchUnits,
  applyUnitSaveFailed,
  applyUnitSaved,
  applyUnitSavedSilently,
  bagLabelData,
  batchReceivingContext,
  batchUnitRow,
  BATCH_UNITS_HEADING,
  CANCEL_LABEL,
  closeLabel,
  CORRECTION_BATCHES_HEADING,
  CORRECTION_BATCHES_HINT,
  CORRECT_LABEL,
  EMPTY_BATCH_UNITS_MESSAGE,
  EMPTY_OPEN_BATCHES_MESSAGE,
  EMPTY_PENDING_BATCHES_MESSAGE,
  enterBagMode,
  initialBagModeState,
  NEW_BATCH_LABEL,
  openLabel,
  openReceivingBatches,
  REPRINT_LABEL,
  SAVE_AND_PRINT_LABEL,
  SAVE_CORRECTION_LABEL,
  SAVE_LABEL,
  UNCONFIRMED_BATCHES_HEADING,
  VOID_CONFIRM_LABEL,
  VOID_LABEL,
  VOID_REASON_LABEL,
  VOIDED_UNITS_HEADING,
  voidedBatchUnits,
  type BagModeState,
  type ReceivingMode,
} from "../lib/receiving";
import { BagLabel } from "./bag-label";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent";

/**
 * Simplified warehouse receiving flow (`Registruoti sandėlyje`).
 *
 * Two entry modes — a new batch (`Nauja partija`) or an existing open `PENDING`
 * batch — then fast, repeated handling-unit registration. The form offers two
 * save actions: `Išsaugoti ir spausdinti` (primary) creates the unit and opens
 * its label (the browser print preview is invoked from the label surface), while
 * `Išsaugoti` (secondary) creates the unit and returns straight to the form.
 * Both keep the batch and the last-used location and reset only the quantity; a
 * failed save opens no label and keeps the entered form data. Only the physical
 * fields the worker knows are shown; formal documentary and reconciliation
 * fields belong to the ADMIN flow.
 */
export function ReceivingPage() {
  const router = useRouter();
  const { clearSession } = useAuth();

  const [mode, setMode] = useState<ReceivingMode>("choose");
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[] | null>(
    null,
  );
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [bagState, setBagState] = useState<BagModeState>(initialBagModeState);
  const [draftBatch, setDraftBatch] = useState<DraftBatch>(createDraftBatch);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submittingUnit, setSubmittingUnit] = useState<"save" | "print" | null>(
    null,
  );
  const quantityInputRef = useRef<HTMLInputElement>(null);
  // Which of the two submit actions was pressed (default: the printing workflow,
  // so pressing Enter in a field prints as before).
  const submitIntentRef = useRef<"save" | "print">("print");

  // Physical correction of an already-registered unit (quantity/location) and
  // voiding, both allowed while the batch is not yet confirmed.
  const [correction, setCorrection] = useState<DraftCorrection | null>(null);
  const [correctingUnit, setCorrectingUnit] = useState(false);
  const [voidingBag, setVoidingBag] = useState<Bag | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidingUnit, setVoidingUnit] = useState(false);

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

  const reloadBatches = useCallback(async (): Promise<void> => {
    try {
      setBatches(await apiFetch<Batch[]>("/batches"));
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti partijų");
    }
  }, [handleError]);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      try {
        const [partnerList, resourceList, warehouseList, batchList] =
          await Promise.all([
            apiFetch<Partner[]>("/partners"),
            apiFetch<Resource[]>("/resources"),
            apiFetch<WarehouseWithLocations[]>("/warehouses"),
            apiFetch<Batch[]>("/batches"),
          ]);
        if (!active) {
          return;
        }
        setPartners(partnerList);
        setResources(resourceList);
        setWarehouses(warehouseList);
        setBatches(batchList);
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti priėmimo duomenų");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [handleError]);

  const labelId = bagState.label?.id ?? null;

  // Invoke the browser print preview from the label surface after a save.
  useEffect(() => {
    if (!labelId) {
      return;
    }
    const timer = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(timer);
  }, [labelId]);

  // Return focus to the quantity field whenever the entry form is shown.
  useEffect(() => {
    if (mode === "bag" && bagState.batch && !labelId) {
      quantityInputRef.current?.focus();
    }
  }, [mode, bagState.batch, labelId]);

  async function loadBatchDetail(batchId: string): Promise<BatchDetail> {
    const detail = await apiFetch<BatchDetail>(`/batches/${batchId}`);
    setBagState(enterBagMode(detail));
    return detail;
  }

  function updateDraft(patch: Partial<DraftBag>): void {
    setBagState((current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  }

  function startNewBatch(): void {
    setMode("new");
    setBagState(initialBagModeState());
    setDraftBatch(createDraftBatch());
    resetUnitEditing();
    setError(null);
    setNotice(null);
  }

  async function selectExistingBatch(batch: Batch): Promise<void> {
    setBagState(initialBagModeState());
    resetUnitEditing();
    setError(null);
    setNotice(null);
    try {
      await loadBatchDetail(batch.id);
      setMode("bag");
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti partijos");
    }
  }

  function backToChoose(): void {
    setMode("choose");
    setBagState(initialBagModeState());
    setDraftBatch(createDraftBatch());
    resetUnitEditing();
    setError(null);
    setNotice(null);
  }

  function closeLabelSurface(): void {
    setBagState(closeLabel);
  }

  function reprintUnit(bagId: string): void {
    const bag = bagState.batch?.bags.find((item) => item.id === bagId);
    if (!bag) {
      return;
    }
    // Reprint reuses the existing unit's label; it creates nothing.
    setBagState((current) => openLabel(current, bag));
  }

  function resetUnitEditing(): void {
    setCorrection(null);
    setVoidingBag(null);
    setVoidReason("");
  }

  function startCorrection(bag: Bag): void {
    setVoidingBag(null);
    setVoidReason("");
    setCorrection(correctionDraftFromBag(bag));
    setError(null);
    setNotice(null);
  }

  function startVoid(bag: Bag): void {
    setCorrection(null);
    setVoidingBag(bag);
    setVoidReason("");
    setError(null);
    setNotice(null);
  }

  function refreshBatch(detail: BatchDetail): void {
    setBagState((current) => ({ ...current, batch: detail }));
  }

  async function submitCorrection(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const bag = bagState.batch?.bags.find((item) => item.id === correction?.id);
    if (!bag || !correction) {
      return;
    }
    const validation = correctionFormError(correction, bag.unit);
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
      refreshBatch(await apiFetch<BatchDetail>(`/batches/${bag.batchId}`));
      setCorrection(null);
      setNotice(`Maišas pataisytas: ${updated.barcode}`);
      await reloadBatches();
    } catch (caught) {
      handleError(caught, "Nepavyko pataisyti maišo");
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
      refreshBatch(await apiFetch<BatchDetail>(`/batches/${bag.batchId}`));
      setVoidingBag(null);
      setVoidReason("");
      setNotice(`Maišas anuliuotas: ${bag.barcode}`);
      await reloadBatches();
    } catch (caught) {
      handleError(caught, "Nepavyko anuliuoti maišo");
    } finally {
      setVoidingUnit(false);
    }
  }

  async function submitNewBatch(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const validation = batchFormError(draftBatch);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await apiFetch<Batch>("/batches", {
        method: "POST",
        body: JSON.stringify(toCreateBatchPayload(draftBatch)),
      });
      setDraftBatch(createDraftBatch());
      setMode("bag");
      setNotice(`Partija sukurta: ${created.code}`);
      await loadBatchDetail(created.id);
      await reloadBatches();
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti partijos");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Create exactly one handling unit and refresh the batch. Shared by both save
   * actions so submission logic is not duplicated; the caller decides whether to
   * open the label surface.
   */
  async function createUnit(): Promise<
    { created: Bag; detail: BatchDetail } | null
  > {
    const batch = bagState.batch;
    if (!batch) {
      return null;
    }
    const created = await apiFetch<Bag>(`/batches/${batch.id}/bags`, {
      method: "POST",
      body: JSON.stringify(toCreateBagPayload(bagState.draft)),
    });
    const detail = await apiFetch<BatchDetail>(`/batches/${batch.id}`);
    return { created, detail };
  }

  async function submitBag(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!bagState.batch) {
      return;
    }
    const validation = bagFormError(bagState.draft);
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
      const result = await createUnit();
      if (!result) {
        return;
      }
      // Save-and-print opens the label straight away; save-only returns to the
      // form. Both keep the batch + last location and reset only the quantity.
      setBagState(
        intent === "print"
          ? applyUnitSaved(result.detail, result.created)
          : applyUnitSavedSilently(result.detail),
      );
      setNotice(`Maišas išsaugotas: ${result.created.barcode}`);
      await reloadBatches();
    } catch (caught) {
      // A failed save opens no label and keeps the entered form data.
      setBagState(applyUnitSaveFailed);
      handleError(caught, "Nepavyko išsaugoti maišo");
    } finally {
      setSubmittingUnit(null);
    }
  }

  const supplierOptions = partners ? activeSuppliers(partners) : [];
  const resourceOptions = resources ? activeResources(resources) : [];
  const warehouseOptions = warehouses ? activeWarehouses(warehouses) : [];
  const openBatches = batches ? openReceivingBatches(batches) : [];
  const pendingBatches = openBatches.filter(
    (batch) => batch.status === "PENDING",
  );
  const correctionBatches = openBatches.filter(
    (batch) => batch.status === "DISCREPANCY",
  );
  const selectedBatch = bagState.batch;
  const savedBag = bagState.label;
  const context = selectedBatch ? batchReceivingContext(selectedBatch) : null;
  const establishedUnit = context?.unit ?? null;
  const locationOptions =
    selectedBatch && warehouses
      ? locationsForWarehouse(warehouses, selectedBatch.warehouseId)
      : [];

  function renderBatchTable(rows: Batch[]) {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Kodas</th>
              <th className="px-4 py-2 font-medium">Tiekėjas</th>
              <th className="px-4 py-2 font-medium">Išteklius</th>
              <th className="px-4 py-2 font-medium">Atvykimo data</th>
              <th className="px-4 py-2 font-medium">Maišai</th>
              <th className="px-4 py-2 font-medium">Kiekis</th>
              <th className="px-4 py-2 font-medium">Būsena</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((batch) => (
              <tr key={batch.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{batch.code}</td>
                <td className="px-4 py-2">{batch.supplierName}</td>
                <td className="px-4 py-2">{batch.resourceName}</td>
                <td className="px-4 py-2">
                  {formatArrivalDate(batch.arrivalDate)}
                </td>
                <td className="px-4 py-2">{batch.bagCount}</td>
                <td className="px-4 py-2">
                  {batch.unit
                    ? formatQuantity(batch.totalQuantity, batch.unit)
                    : "—"}
                </td>
                <td className="px-4 py-2">{batchStatusLabel(batch.status)}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void selectExistingBatch(batch)}
                    className={secondaryButtonClass}
                  >
                    Pasirinkti
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {RECEIVE_ACTION.label}
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

      {mode === "choose" ? (
        <section className="flex flex-col gap-6">
          <button
            type="button"
            onClick={startNewBatch}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-4 text-base font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
          >
            <PlusIcon />
            {NEW_BATCH_LABEL}
          </button>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">
              {UNCONFIRMED_BATCHES_HEADING}
            </h2>
            {batches === null ? (
              <p className="text-sm text-muted-foreground">Kraunama…</p>
            ) : openBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {EMPTY_OPEN_BATCHES_MESSAGE}
              </p>
            ) : pendingBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {EMPTY_PENDING_BATCHES_MESSAGE}
              </p>
            ) : (
              renderBatchTable(pendingBatches)
            )}
          </div>

          {batches !== null && correctionBatches.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">
                {CORRECTION_BATCHES_HEADING}
              </h2>
              <p className="text-sm text-muted-foreground">
                {CORRECTION_BATCHES_HINT}
              </p>
              {renderBatchTable(correctionBatches)}
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === "new" ? (
        <section className={workSurfaceClass()}>
          <form onSubmit={submitNewBatch} className="grid gap-4">
            <h2 className="text-lg font-medium">{NEW_BATCH_LABEL}</h2>

            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Tiekėjas</span>
              <select
                required
                value={draftBatch.supplierId}
                onChange={(event) =>
                  setDraftBatch({ ...draftBatch, supplierId: event.target.value })
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

            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Išteklius</span>
              <select
                required
                value={draftBatch.resourceId}
                onChange={(event) =>
                  setDraftBatch({ ...draftBatch, resourceId: event.target.value })
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

            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Sandėlis</span>
              <select
                required
                value={draftBatch.warehouseId}
                onChange={(event) =>
                  setDraftBatch({ ...draftBatch, warehouseId: event.target.value })
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

            <label className="grid gap-1 text-sm sm:max-w-xs">
              <span className="font-medium">Atvykimo data</span>
              <input
                required
                type="date"
                value={draftBatch.arrivalDate}
                onChange={(event) =>
                  setDraftBatch({ ...draftBatch, arrivalDate: event.target.value })
                }
                className={inputClass}
              />
            </label>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={backToChoose}
                className={secondaryButtonClass}
              >
                Atgal
              </button>
              <button type="submit" disabled={busy} className={primaryButtonClass}>
                {busy ? "Kuriama…" : "Sukurti partiją"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {mode === "bag" && selectedBatch && context && !savedBag ? (
        <section className={workSurfaceClass()}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">Partija {context.code}</h2>
              <span className="text-sm text-muted-foreground">
                {batchStatusLabel(selectedBatch.status)}
              </span>
            </div>

            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium">Tiekėjas</dt>
                <dd className="text-sm text-muted-foreground">
                  {context.supplierName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Išteklius</dt>
                <dd className="text-sm text-muted-foreground">
                  {context.resourceName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Sandėlis</dt>
                <dd className="text-sm text-muted-foreground">
                  {context.warehouseName}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Atvykimo data</dt>
                <dd className="text-sm text-muted-foreground">
                  {formatArrivalDate(context.arrivalDate)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Maišai / kiekis</dt>
                <dd className="text-sm text-muted-foreground">
                  {context.bagCount} ·{" "}
                  {context.unit
                    ? formatQuantity(context.totalQuantity, context.unit)
                    : "—"}
                </dd>
              </div>
            </dl>

            <form
              onSubmit={submitBag}
              className="grid gap-3 border-t border-border pt-4"
            >
              <h3 className="text-base font-medium">Naujas maišas</h3>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-5">
                  <span className="font-medium">Vieta</span>
                  <select
                    required
                    value={bagState.draft.warehouseLocationId}
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
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">Vienetas</span>
                  <select
                    value={establishedUnit ?? bagState.draft.unit}
                    disabled={establishedUnit !== null}
                    onChange={(event) =>
                      updateDraft({ unit: event.target.value as DraftBag["unit"] })
                    }
                    className={inputClass}
                  >
                    {HANDLING_UNIT_KEYS.map((unit) => (
                      <option key={unit} value={unit}>
                        {handlingUnitLabel(unit)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm sm:col-span-4">
                  <span className="font-medium">Kiekis</span>
                  <input
                    ref={quantityInputRef}
                    required
                    type="number"
                    inputMode={
                      (establishedUnit ?? bagState.draft.unit) === "PCS"
                        ? "numeric"
                        : "decimal"
                    }
                    min="0"
                    step={
                      (establishedUnit ?? bagState.draft.unit) === "PCS"
                        ? "1"
                        : "0.001"
                    }
                    value={bagState.draft.quantity}
                    onChange={(event) =>
                      updateDraft({ quantity: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={submittingUnit !== null}
                  onClick={() => {
                    submitIntentRef.current = "save";
                  }}
                  className={secondaryButtonClass}
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
                  className={primaryButtonClass}
                >
                  <PrinterIcon />
                  {submittingUnit === "print" ? "Saugoma…" : SAVE_AND_PRINT_LABEL}
                </button>
              </div>
            </form>

            <div className="flex items-center justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={backToChoose}
                className={secondaryButtonClass}
              >
                Kita partija
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {mode === "bag" && selectedBatch && !savedBag ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{BATCH_UNITS_HEADING}</h2>
          {activeBatchUnits(selectedBatch).length === 0 ? (
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
                    <th className="px-4 py-2 font-medium">Kiekis</th>
                    <th className="px-4 py-2 font-medium">Mato vnt.</th>
                    <th className="px-4 py-2 font-medium">Užregistruota</th>
                    <th className="px-4 py-2 font-medium">Veiksmai</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBatchUnits(selectedBatch).map((bag) => {
                    const row = batchUnitRow(bag);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-2 font-mono">{row.barcode}</td>
                        <td className="px-4 py-2">{row.locationName}</td>
                        <td className="px-4 py-2">{row.quantity}</td>
                        <td className="px-4 py-2">
                          {handlingUnitLabel(row.unit)}
                        </td>
                        <td className="px-4 py-2">
                          {formatBatchDateTime(row.registeredAt)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startCorrection(bag)}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              {CORRECT_LABEL}
                            </button>
                            <button
                              type="button"
                              onClick={() => startVoid(bag)}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                            >
                              {VOID_LABEL}
                            </button>
                            <button
                              type="button"
                              onClick={() => reprintUnit(row.id)}
                              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
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
              <h3 className="text-base font-medium">Koreguoti maišą</h3>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-6">
                  <span className="font-medium">Vieta</span>
                  <select
                    value={correction.warehouseLocationId}
                    onChange={(event) =>
                      setCorrection({
                        ...correction,
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
                <label className="grid gap-1 text-sm sm:col-span-6">
                  <span className="font-medium">Kiekis</span>
                  <input
                    type="number"
                    inputMode={establishedUnit === "PCS" ? "numeric" : "decimal"}
                    min="0"
                    step={establishedUnit === "PCS" ? "1" : "0.001"}
                    value={correction.quantity}
                    onChange={(event) =>
                      setCorrection({
                        ...correction,
                        quantity: event.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCorrection(null)}
                  className={secondaryButtonClass}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="submit"
                  disabled={correctingUnit}
                  className={primaryButtonClass}
                >
                  {correctingUnit ? "Saugoma…" : SAVE_CORRECTION_LABEL}
                </button>
              </div>
            </form>
          ) : null}

          {voidingBag ? (
            <div className="grid gap-3 rounded-xl border border-destructive/40 p-4">
              <h3 className="text-base font-medium">
                Anuliuoti maišą {voidingBag.barcode}
              </h3>
              <p className="text-sm text-muted-foreground">
                Maišas bus pažymėtas kaip anuliuotas ir nebeįskaičiuojamas į
                kiekį. Duomenys išlieka.
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
                  className={secondaryButtonClass}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="button"
                  onClick={() => void submitVoid()}
                  disabled={voidingUnit}
                  className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"
                >
                  {voidingUnit ? "Anuliuojama…" : VOID_CONFIRM_LABEL}
                </button>
              </div>
            </div>
          ) : null}

          {voidedBatchUnits(selectedBatch).length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-medium">{VOIDED_UNITS_HEADING}</h3>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Barkodas</th>
                      <th className="px-4 py-2 font-medium">Kiekis</th>
                      <th className="px-4 py-2 font-medium">Būsena</th>
                      <th className="px-4 py-2 font-medium">Anuliavo</th>
                      <th className="px-4 py-2 font-medium">Priežastis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidedBatchUnits(selectedBatch).map((bag) => (
                      <tr
                        key={bag.id}
                        className="border-t border-border text-muted-foreground"
                      >
                        <td className="px-4 py-2 font-mono">{bag.barcode}</td>
                        <td className="px-4 py-2">
                          {formatQuantity(bag.quantity, bag.unit)}
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

      {mode === "bag" && selectedBatch && savedBag ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Etiketė · Partija {selectedBatch.code}
            </h2>
            <button
              type="button"
              onClick={closeLabelSurface}
              className={secondaryButtonClass}
            >
              Uždaryti
            </button>
          </div>
          <BagLabel label={bagLabelData(selectedBatch, savedBag)} />
          <div>
            <button
              type="button"
              onClick={() => window.print()}
              className={primaryButtonClass}
            >
              Spausdinti
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
