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
  BATCH_RECEIVING_MODES,
  BATCH_RECEIVING_MODE_LABELS,
  type Bag,
  type Batch,
  type BatchDetail,
  type BatchItem,
  type BatchReceivingMode,
  type IncomingDeliveryDetail,
  type PackagingType,
  type Partner,
  type Resource,
  type ResourceCategory,
  type WarehouseWithLocations,
} from "@aitvaras/contracts";
import {
  bagStatusClass,
  bagStatusLabel,
  batchItemStatusClass,
  batchItemStatusLabel,
  batchReceivingModeLabel,
  batchStatusLabel,
  canPrintLabel,
  EMPTY_BATCH_ITEMS_MESSAGE,
  formatArrivalDate,
  formatBatchDateTime,
  formatPieces,
  formatWeight,
} from "@/entities/batch";
import { activeResourceCategories } from "@/entities/resource-category";
import {
  activePackagingTypes,
  findPackagingType,
  packagingTypeOptionLabel,
} from "@/entities/packaging-type";
import { activeResources } from "@/entities/resource";
import {
  activeWarehouses,
  locationsForWarehouse,
} from "@/entities/warehouse";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { focusField } from "@/shared/lib/form-feedback";
import {
  DESTRUCTIVE_BUTTON_CLASS,
  OUTLINE_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  PrinterIcon,
  SECONDARY_BUTTON_CLASS,
  SECONDARY_NAV_BUTTON_CLASS,
  SaveIcon,
  useToast,
} from "@/shared/ui";
import {
  bagFormError,
  correctionChanged,
  correctionDraftFromBag,
  correctionFormError,
  createDraftPieceItem,
  createDraftQuickResource,
  pieceCorrectionChanged,
  pieceCorrectionFormError,
  pieceCorrectionFromItem,
  pieceItemFormError,
  quickResourceFormError,
  resourceFormError,
  toCreateBagPayload,
  toCreateItemPayload,
  toQuickCreateResourcePayload,
  toResolveBatchPayload,
  toUpdateBagPayload,
  toUpdateItemPayload,
  toVoidBagPayload,
  toVoidItemPayload,
  type DraftBag,
  type DraftCorrection,
  type DraftPieceCorrection,
  type DraftPieceItem,
  type DraftQuickResource,
} from "../lib/batch-form";
import { batchStatusClass } from "../lib/batch-list";
import {
  activeBatchItems,
  activeBatchUnits,
  applyUnitSaveFailed,
  applyUnitSaved,
  applyUnitSavedSilently,
  bagLabelData,
  batchTotalPieces,
  batchUnitRow,
  BATCH_TYPE_LABEL,
  BATCH_UNITS_HEADING,
  CANCEL_LABEL,
  closeLabel,
  CORRECT_ITEM_LABEL,
  CORRECT_LABEL,
  DELIVERIES_LIST_BACK_LABEL,
  DELIVERY_CONTENTS_HEADING,
  deliveryBatches,
  EMPTY_BATCH_UNITS_MESSAGE,
  EMPTY_DELIVERY_CONTENTS_MESSAGE,
  enterBatch,
  enterDelivery,
  initialReceivingState,
  ITEM_LOCATION_LABEL,
  ITEM_QUANTITY_LABEL,
  ITEM_RESOURCE_LABEL,
  ITEMS_TOTAL_LABEL,
  NEW_BATCH_LABEL,
  NEW_PRODUCT_LABEL,
  openLabel,
  PIECE_BARCODE_LABEL,
  PIECE_BATCH_HEADING,
  PIECE_ITEMS_HEADING,
  PIECE_LABEL_ACTION,
  pieceLabelData,
  PRINT_LABEL,
  REPRINT_LABEL,
  SAVE_AND_PRINT_LABEL,
  SAVE_CORRECTION_LABEL,
  SAVE_LABEL,
  START_RESOURCE_LABEL,
  VOID_CONFIRM_LABEL,
  VOID_ITEM_CONFIRM_LABEL,
  VOID_ITEM_LABEL,
  VOID_LABEL,
  VOID_REASON_LABEL,
  VOIDED_UNITS_HEADING,
  voidedBatchItems,
  voidedBatchUnits,
  type ReceivingState,
} from "../lib/receiving";
import { BagLabel } from "./bag-label";
import { BatchRegistrationEditor } from "./batch-registration-editor";
import { PieceLabel } from "./piece-label";

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
 * One `Priėmimas` is one physical arrival of one supplier on one arrival date and
 * may contain several resources. Each batch is one resource into one warehouse.
 * Packages are received by weight: the worker selects `Tara`, `Vieta` and enters
 * only `Bruto svoris`; the server derives net weight (gross − tare).
 */
export function ReceivingDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const deliveryId =
    typeof params.deliveryId === "string" ? params.deliveryId : "";
  const batchId = typeof params.batchId === "string" ? params.batchId : "";
  const { clearSession } = useAuth();
  const toast = useToast();

  const [resources, setResources] = useState<Resource[] | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[] | null>(
    null,
  );
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[] | null>(
    null,
  );
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [state, setState] = useState<ReceivingState>(initialReceivingState);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [submittingUnit, setSubmittingUnit] = useState<"save" | "print" | null>(
    null,
  );
  const [correction, setCorrection] = useState<DraftCorrection | null>(null);
  const [correctingUnit, setCorrectingUnit] = useState(false);
  const [voidingBag, setVoidingBag] = useState<Bag | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidingUnit, setVoidingUnit] = useState(false);
  const [batchMode, setBatchMode] = useState<BatchReceivingMode>("WEIGHT");
  const [pieceDraft, setPieceDraft] =
    useState<DraftPieceItem>(createDraftPieceItem);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<DraftPieceCorrection | null>(
    null,
  );
  const [correctingItem, setCorrectingItem] = useState(false);
  const [voidingItem, setVoidingItem] = useState<BatchItem | null>(null);
  const [itemVoidReason, setItemVoidReason] = useState("");
  const [voidingItemBusy, setVoidingItemBusy] = useState(false);
  const [pieceLabel, setPieceLabel] = useState<BatchItem | null>(null);
  const [categories, setCategories] = useState<ResourceCategory[] | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDraft, setQuickDraft] =
    useState<DraftQuickResource>(createDraftQuickResource);
  const [quickSaving, setQuickSaving] = useState(false);
  const grossInputRef = useRef<HTMLInputElement>(null);
  const submitIntentRef = useRef<"save" | "print">("print");

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

  useEffect(() => {
    if (!deliveryId) {
      setLoading(false);
      return;
    }
    let active = true;
    async function load(): Promise<void> {
      try {
        const [
          resourceList,
          warehouseList,
          packagingList,
          categoryList,
          partnerList,
          detail,
          batchDetail,
        ] = await Promise.all([
          apiFetch<Resource[]>("/resources"),
          apiFetch<WarehouseWithLocations[]>("/warehouses"),
          apiFetch<PackagingType[]>("/packaging-types"),
          apiFetch<ResourceCategory[]>("/resource-categories"),
          apiFetch<Partner[]>("/partners"),
          apiFetch<IncomingDeliveryDetail>(`/deliveries/${deliveryId}`),
          batchId
            ? apiFetch<BatchDetail>(`/batches/${batchId}`)
            : Promise.resolve(null),
        ]);
        if (!active) {
          return;
        }
        setResources(resourceList);
        setWarehouses(warehouseList);
        setPackagingTypes(packagingList);
        setCategories(categoryList);
        setPartners(partnerList);
        setState(
          batchDetail
            ? enterBatch(enterDelivery(detail), batchDetail)
            : enterDelivery(detail),
        );
      } catch (caught) {
        if (active) {
          handleError(caught, "Nepavyko įkelti priėmimo");
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
  }, [deliveryId, batchId, handleError]);

  const pieceLabelId = pieceLabel?.id ?? null;

  // Invoke the browser print preview for a PIECE group label after a print save.
  useEffect(() => {
    if (!pieceLabelId) {
      return;
    }
    const timer = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(timer);
  }, [pieceLabelId]);

  const labelId = state.label?.id ?? null;

  // Invoke the browser print preview from the label surface after a save.
  useEffect(() => {
    if (!labelId) {
      return;
    }
    const timer = window.setTimeout(() => window.print(), 50);
    return () => window.clearTimeout(timer);
  }, [labelId]);

  // Return focus to the gross-weight field whenever the weight form is shown.
  useEffect(() => {
    if (state.batch?.receivingMode === "WEIGHT" && !labelId) {
      grossInputRef.current?.focus();
    }
  }, [state.batch, labelId]);

  function closeLabelSurface(): void {
    setState(closeLabel);
  }

  async function reloadAfterConflict(): Promise<void> {
    if (!state.batch || !state.delivery) {
      return;
    }
    try {
      const [freshBatch, freshDelivery] = await Promise.all([
        apiFetch<BatchDetail>(`/batches/${state.batch.id}`),
        apiFetch<IncomingDeliveryDetail>(`/deliveries/${state.delivery.id}`),
      ]);
      setState(enterBatch(enterDelivery(freshDelivery), freshBatch));
    } catch (caught) {
      handleError(caught, "Nepavyko atnaujinti partijos būsenos.");
    }
  }

  function closePieceLabel(): void {
    setPieceLabel(null);
  }

  function reprintPiece(itemId: string): void {
    const item = state.batch?.items.find((entry) => entry.id === itemId);
    if (item && canPrintLabel(item.status)) {
      setPieceLabel(item);
    }
  }

  function reprintUnit(bagId: string): void {
    const bag = state.batch?.bags.find((item) => item.id === bagId);
    if (!bag || !canPrintLabel(bag.status)) {
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
    const validation = resourceFormError(state.resource, batchMode);
    if (validation) {
      toast.error(validation);
      focusField(
        batchMode === "WEIGHT" && state.resource.resourceId.trim() === ""
          ? "batch-resource"
          : "batch-warehouse",
      );
      return;
    }
    setResolving(true);

    try {
      const batch = await apiFetch<BatchDetail>(
        `/deliveries/${delivery.id}/batches`,
        {
          method: "POST",
          body: JSON.stringify(toResolveBatchPayload(state.resource, batchMode)),
        },
      );
      // A batch has its own route so re-entry resumes the SAME batch.
      router.push(`/receiving/${delivery.id}/batches/${batch.id}`);
    } catch (caught) {
      handleError(caught, "Nepavyko pradėti partijos");
    } finally {
      setResolving(false);
    }
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
      toast.error(validation);
      focusField(
        state.draft.packagingTypeId.trim() === ""
          ? "bag-packaging"
          : state.draft.warehouseLocationId.trim() === ""
            ? "bag-location"
            : "bag-gross",
      );
      return;
    }
    const intent = submitIntentRef.current;
    setSubmittingUnit(intent);

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
      toast.success(`Pakuotė išsaugota: ${created.barcode}`);
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
      toast.error(validation);
      focusField(
        correction.packagingTypeId.trim() === ""
          ? "correction-packaging"
          : correction.warehouseLocationId.trim() === ""
            ? "correction-location"
            : "correction-gross",
      );
      return;
    }
    if (!correctionChanged(correction, bag)) {
      setCorrection(null);
      return;
    }
    setCorrectingUnit(true);

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
      toast.success(`Pakuotė pataisyta: ${updated.barcode}`);
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
      toast.success(`Pakuotė anuliuota: ${bag.barcode}`);
    } catch (caught) {
      handleError(caught, "Nepavyko anuliuoti pakuotės");
    } finally {
      setVoidingUnit(false);
    }
  }

  function updatePieceDraft(patch: Partial<DraftPieceItem>): void {
    setPieceDraft((current) => ({ ...current, ...patch }));
  }

  async function submitItem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const batch = state.batch;
    if (!batch) {
      return;
    }
    const validation = pieceItemFormError(pieceDraft);
    if (validation) {
      toast.error(validation);
      focusField(
        pieceDraft.resourceId.trim() === ""
          ? "piece-resource"
          : pieceDraft.warehouseLocationId.trim() === ""
            ? "piece-location"
            : "piece-quantity",
      );
      return;
    }
    const intent = submitIntentRef.current;
    setSubmittingItem(true);

    try {
      const created = await apiFetch<BatchItem>(`/batches/${batch.id}/items`, {
        method: "POST",
        body: JSON.stringify(toCreateItemPayload(pieceDraft)),
      });
      // Keep the location for fast repeated entry; clear product + quantity.
      setPieceDraft({
        ...createDraftPieceItem(),
        warehouseLocationId: pieceDraft.warehouseLocationId,
      });
      // Refresh both the active batch and the parent receipt so `Priėmimo
      // turinys` reflects the new totals immediately (server-derived).
      const refreshed = await refreshBatchAndDelivery();
      if (refreshed) {
        setState((current) => ({
          ...current,
          batch: refreshed.batch,
          delivery: refreshed.delivery,
        }));
      }
      if (intent === "print") {
        setPieceLabel(created);
      } else {
        toast.success(
          `Prekė pridėta: ${created.resourceName} (${created.quantity} vnt.)`,
        );
      }
    } catch (caught) {
      handleError(caught, "Nepavyko pridėti prekės");
    } finally {
      setSubmittingItem(false);
    }
  }

  function updateEditingItem(patch: Partial<DraftPieceCorrection>): void {
    setEditingItem((current) => (current ? { ...current, ...patch } : current));
  }

  async function submitItemCorrection(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const batch = state.batch;
    if (!batch || !editingItem) {
      return;
    }
    const item = batch.items.find((entry) => entry.id === editingItem.id);
    if (!item) {
      return;
    }
    const validation = pieceCorrectionFormError(editingItem);
    if (validation) {
      toast.error(validation);
      focusField(
        editingItem.resourceId.trim() === ""
          ? "piece-correction-resource"
          : editingItem.warehouseLocationId.trim() === ""
            ? "piece-correction-location"
            : "piece-correction-quantity",
      );
      return;
    }
    if (!pieceCorrectionChanged(editingItem, item)) {
      setEditingItem(null);
      return;
    }
    setCorrectingItem(true);

    try {
      await apiFetch<BatchItem>(`/batches/${batch.id}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(toUpdateItemPayload(editingItem, item)),
      });
      // Refresh both the active batch and the parent receipt so `Priėmimo
      // turinys` reflects the new totals immediately (server-derived).
      const refreshed = await refreshBatchAndDelivery();
      if (refreshed) {
        setState((current) => ({
          ...current,
          batch: refreshed.batch,
          delivery: refreshed.delivery,
        }));
      }
      setEditingItem(null);
      toast.success("Eilutė pataisyta.");
    } catch (caught) {
      handleError(caught, "Nepavyko pataisyti eilutės");
    } finally {
      setCorrectingItem(false);
    }
  }

  async function submitItemVoid(): Promise<void> {
    const batch = state.batch;
    const item = voidingItem;
    if (!batch || !item) {
      return;
    }
    setVoidingItemBusy(true);

    try {
      await apiFetch<BatchItem>(`/batches/${batch.id}/items/${item.id}/void`, {
        method: "POST",
        body: JSON.stringify(toVoidItemPayload(itemVoidReason)),
      });
      // Refresh both the active batch and the parent receipt so `Priėmimo
      // turinys` reflects the new totals immediately (server-derived).
      const refreshed = await refreshBatchAndDelivery();
      if (refreshed) {
        setState((current) => ({
          ...current,
          batch: refreshed.batch,
          delivery: refreshed.delivery,
        }));
      }
      setVoidingItem(null);
      setItemVoidReason("");
      toast.success(`Eilutė anuliuota: ${item.resourceName}`);
    } catch (caught) {
      handleError(caught, "Nepavyko anuliuoti eilutės");
    } finally {
      setVoidingItemBusy(false);
    }
  }

  async function submitQuickResource(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const validation = quickResourceFormError(quickDraft);
    if (validation) {
      toast.error(validation);
      focusField(
        quickDraft.name.trim() === ""
          ? "quick-resource-name"
          : "quick-resource-category",
      );
      return;
    }
    setQuickSaving(true);
    try {
      const created = await apiFetch<Resource>(
        "/resources/receiving-quick-create",
        {
          method: "POST",
          body: JSON.stringify(toQuickCreateResourcePayload(quickDraft)),
        },
      );
      const fresh = await apiFetch<Resource[]>("/resources");
      setResources(fresh);
      setPieceDraft((current) => ({ ...current, resourceId: created.id }));
      setQuickOpen(false);
      setQuickDraft(createDraftQuickResource());
      toast.success(`Prekė sukurta: ${created.name}`);
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti prekės");
    } finally {
      setQuickSaving(false);
    }
  }

  const resourceOptions = resources ? activeResources(resources) : [];
  const categoryOptions = categories ? activeResourceCategories(categories) : [];
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
        {delivery ? `Priėmimas ${delivery.code}` : "Priėmimas"}
      </h1>

      {batchId && state.batch && state.delivery ? (
        state.batch.status === "PENDING" &&
        partners &&
        resources &&
        warehouses ? (
          <BatchRegistrationEditor
            delivery={state.delivery}
            batch={state.batch}
            partners={partners}
            resources={resources}
            warehouses={warehouses}
            onSaved={() => router.push(`/receipts/batches/${state.batch?.id}`)}
            onCancel={() => router.push(`/receipts/batches/${state.batch?.id}`)}
            onConflict={() => void reloadAfterConflict()}
          />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Partija patvirtinta; registracijos duomenų redaguoti negalima.
          </p>
        )
      ) : null}

      {loading && !delivery ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : null}

      {!loading && !delivery ? (
        <p className="text-sm text-muted-foreground">Priėmimas nerastas.</p>
      ) : null}

      {delivery ? (
        <section className={workSurfaceClass()}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">Priėmimas {delivery.code}</h2>
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
                        <th className="px-4 py-2 font-medium">Turinys</th>
                        <th className="px-4 py-2 font-medium">Sandėlis</th>
                        <th className="px-4 py-2 font-medium">Kiekis</th>
                        <th className="px-4 py-2 font-medium">Svoris / vnt.</th>
                        <th className="px-4 py-2 font-medium">Būsena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveryBatches(delivery).map((batch) => (
                        <DeliveryBatchRow
                          key={batch.id}
                          batch={batch}
                          active={batch.id === activeBatch?.id}
                          href={`/receiving/${deliveryId}/batches/${batch.id}`}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!batchId ? (
              <div className="grid gap-3 border-t border-border pt-4">
                <h3 className="text-base font-medium">{NEW_BATCH_LABEL}</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">{BATCH_TYPE_LABEL}</span>
                    <select
                      value={batchMode}
                      onChange={(event) =>
                        setBatchMode(event.target.value as BatchReceivingMode)
                      }
                      className={`${inputClass} w-40`}
                    >
                      {BATCH_RECEIVING_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {BATCH_RECEIVING_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {batchMode === "WEIGHT" ? (
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">Išteklius</span>
                      <select
                        id="batch-resource"
                        value={state.resource.resourceId}
                        onChange={(event) =>
                          updateResource({ resourceId: event.target.value })
                        }
                        className={`${inputClass} w-64`}
                      >
                        <option value="">— Pasirinkti —</option>
                        {resourceOptions.map((resource) => (
                          <option key={resource.id} value={resource.id}>
                            {resource.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Sandėlis</span>
                    <select
                      id="batch-warehouse"
                      value={state.resource.warehouseId}
                      onChange={(event) =>
                        updateResource({ warehouseId: event.target.value })
                      }
                      className={`${inputClass} w-48`}
                    >
                      <option value="">— Pasirinkti —</option>
                      {warehouseOptions.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
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
            ) : activeBatch ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <p className="text-sm">
                  <span className="font-medium">
                    {activeBatch.receivingMode === "PIECE"
                      ? `${PIECE_BATCH_HEADING} ${activeBatch.code}`
                      : activeBatch.resourceName}
                  </span>{" "}
                  · {activeBatch.warehouseName} ·{" "}
                  {batchReceivingModeLabel(activeBatch.receivingMode)}
                </p>
                <Link
                  href={`/receiving/${deliveryId}`}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  ← {DELIVERY_CONTENTS_HEADING}
                </Link>
              </div>
            ) : null}

            {activeBatch?.receivingMode === "WEIGHT" &&
            activeBatch.status === "PENDING" &&
            !savedBag ? (
              <form
                onSubmit={submitBag}
                noValidate
                className="grid gap-3 border-t border-border pt-4"
              >
                <h3 className="text-base font-medium">Nauja pakuotė</h3>
                <div className="grid gap-3 sm:grid-cols-12">
                  <label className="grid gap-1 text-sm sm:col-span-4">
                    <span className="font-medium">Tara</span>
                    <select
                      id="bag-packaging"
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
                          {packagingTypeOptionLabel(type)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm sm:col-span-4">
                    <span className="font-medium">Vieta</span>
                    <select
                      id="bag-location"
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
                      id="bag-gross"
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

      {delivery &&
      activeBatch &&
      activeBatch.receivingMode === "PIECE" &&
      !pieceLabel ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">
            {PIECE_BATCH_HEADING} {activeBatch.code}
          </h2>

          {activeBatch.status === "PENDING" ? (
            <>
              <form onSubmit={submitItem} noValidate className={workSurfaceClass()}>
            <div className="grid gap-3 sm:grid-cols-12">
              <div className="grid gap-1 text-sm sm:col-span-6">
                <label className="grid gap-1">
                  <span className="font-medium">{ITEM_RESOURCE_LABEL}</span>
                  <select
                    id="piece-resource"
                    required
                    value={pieceDraft.resourceId}
                    onChange={(event) =>
                      updatePieceDraft({ resourceId: event.target.value })
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
                <button
                  type="button"
                  onClick={() => setQuickOpen((current) => !current)}
                  className={`${SECONDARY_NAV_BUTTON_CLASS} self-start`}
                >
                  {NEW_PRODUCT_LABEL}
                </button>
              </div>
              <label className="grid gap-1 text-sm sm:col-span-3">
                <span className="font-medium">{ITEM_QUANTITY_LABEL}</span>
                <input
                  id="piece-quantity"
                  required
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={pieceDraft.quantity}
                  onChange={(event) =>
                    updatePieceDraft({ quantity: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-3">
                <span className="font-medium">{ITEM_LOCATION_LABEL}</span>
                <select
                  id="piece-location"
                  required
                  value={pieceDraft.warehouseLocationId}
                  onChange={(event) =>
                    updatePieceDraft({
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
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                disabled={submittingItem}
                onClick={() => {
                  submitIntentRef.current = "save";
                }}
                className={SECONDARY_BUTTON_CLASS}
              >
                <SaveIcon />
                {submittingItem ? "Saugoma…" : SAVE_LABEL}
              </button>
              <button
                type="submit"
                disabled={submittingItem}
                onClick={() => {
                  submitIntentRef.current = "print";
                }}
                className={PRIMARY_BUTTON_CLASS}
              >
                <PrinterIcon />
                {submittingItem ? "Saugoma…" : SAVE_AND_PRINT_LABEL}
              </button>
            </div>
          </form>

          {quickOpen ? (
            <form
              onSubmit={submitQuickResource}
              noValidate
              className="grid gap-3 rounded-xl border border-border p-4"
            >
              <h3 className="text-base font-medium">{NEW_PRODUCT_LABEL}</h3>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-6">
                  <span className="font-medium">{ITEM_RESOURCE_LABEL}</span>
                  <input
                    id="quick-resource-name"
                    required
                    type="text"
                    maxLength={255}
                    value={quickDraft.name}
                    onChange={(event) =>
                      setQuickDraft({ ...quickDraft, name: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-6">
                  <span className="font-medium">Kategorija</span>
                  <select
                    id="quick-resource-category"
                    required
                    value={quickDraft.categoryId}
                    onChange={(event) =>
                      setQuickDraft({
                        ...quickDraft,
                        categoryId: event.target.value,
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">— Pasirinkti —</option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickOpen(false)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="submit"
                  disabled={quickSaving}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {quickSaving ? "Saugoma…" : "Sukurti"}
                </button>
              </div>
            </form>
          ) : null}
            </>
          ) : null}

          <h3 className="text-base font-medium">{PIECE_ITEMS_HEADING}</h3>
          {activeBatchItems(activeBatch).length === 0 ? (
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
                    <th className="px-4 py-2 font-medium">
                      {PIECE_BARCODE_LABEL}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {PIECE_LABEL_ACTION}
                    </th>
                    <th className="px-4 py-2 font-medium">Veiksmai</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBatchItems(activeBatch).map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-2">{item.resourceName}</td>
                      <td className="px-4 py-2">{item.quantity} vnt.</td>
                      <td className="px-4 py-2">
                        {item.warehouseLocationName}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {item.barcode}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className={OUTLINE_BUTTON_CLASS}
                          onClick={() => reprintPiece(item.id)}
                        >
                          {PRINT_LABEL}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {activeBatch.status === "PENDING" ? (
                            <>
                              <button
                                type="button"
                                className={OUTLINE_BUTTON_CLASS}
                                onClick={() => {
                                  setVoidingItem(null);
                                  setItemVoidReason("");
                                  setEditingItem(pieceCorrectionFromItem(item));
                                }}
                              >
                                {CORRECT_ITEM_LABEL}
                              </button>
                              <button
                                type="button"
                                className={OUTLINE_BUTTON_CLASS}
                                onClick={() => {
                                  setEditingItem(null);
                                  setVoidingItem(item);
                                  setItemVoidReason("");
                                }}
                              >
                                {VOID_ITEM_LABEL}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-sm font-medium">
            {ITEMS_TOTAL_LABEL}: {formatPieces(batchTotalPieces(activeBatch))}
          </p>

          {editingItem ? (
            <form
              onSubmit={submitItemCorrection}
              noValidate
              className="grid gap-3 rounded-xl border border-border p-4"
            >
              <h3 className="text-base font-medium">Koreguoti eilutę</h3>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-6">
                  <span className="font-medium">{ITEM_RESOURCE_LABEL}</span>
                  <select
                    id="piece-correction-resource"
                    value={editingItem.resourceId}
                    onChange={(event) =>
                      updateEditingItem({ resourceId: event.target.value })
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
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">{ITEM_QUANTITY_LABEL}</span>
                  <input
                    id="piece-correction-quantity"
                    required
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={editingItem.quantity}
                    onChange={(event) =>
                      updateEditingItem({ quantity: event.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-3">
                  <span className="font-medium">{ITEM_LOCATION_LABEL}</span>
                  <select
                    id="piece-correction-location"
                    value={editingItem.warehouseLocationId}
                    onChange={(event) =>
                      updateEditingItem({
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
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="submit"
                  disabled={correctingItem}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {correctingItem ? "Saugoma…" : SAVE_CORRECTION_LABEL}
                </button>
              </div>
            </form>
          ) : null}

          {voidingItem ? (
            <div className="grid gap-3 rounded-xl border border-destructive/40 p-4">
              <h3 className="text-base font-medium">
                Anuliuoti eilutę {voidingItem.resourceName}
              </h3>
              <p className="text-sm text-muted-foreground">
                Eilutė bus pažymėta kaip anuliuota ir nebeįskaičiuojama į
                vienetus. Duomenys išlieka.
              </p>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{VOID_REASON_LABEL}</span>
                <input
                  type="text"
                  maxLength={500}
                  value={itemVoidReason}
                  onChange={(event) => setItemVoidReason(event.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVoidingItem(null);
                    setItemVoidReason("");
                  }}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  {CANCEL_LABEL}
                </button>
                <button
                  type="button"
                  onClick={() => void submitItemVoid()}
                  disabled={voidingItemBusy}
                  className={DESTRUCTIVE_BUTTON_CLASS}
                >
                  {voidingItemBusy ? "Anuliuojama…" : VOID_ITEM_CONFIRM_LABEL}
                </button>
              </div>
            </div>
          ) : null}

          {voidedBatchItems(activeBatch).length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-medium">{VOIDED_UNITS_HEADING}</h3>
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
                    {voidedBatchItems(activeBatch).map((item) => (
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
            </div>
          ) : null}
        </section>
      ) : null}

      {delivery &&
      activeBatch &&
      activeBatch.receivingMode === "WEIGHT" &&
      !savedBag ? (
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
                            {activeBatch.status === "PENDING" ? (
                              <>
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
                              </>
                            ) : null}
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
              noValidate
              className="grid gap-3 rounded-xl border border-border p-4"
            >
              <h3 className="text-base font-medium">Koreguoti pakuotę</h3>
              <div className="grid gap-3 sm:grid-cols-12">
                <label className="grid gap-1 text-sm sm:col-span-4">
                  <span className="font-medium">Tara</span>
                  <select
                    id="correction-packaging"
                    value={correction.packagingTypeId}
                    onChange={(event) =>
                      updateCorrection({ packagingTypeId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">— Pasirinkti —</option>
                    {packagingOptions.map((type) => (
                      <option key={type.id} value={type.id}>
                        {packagingTypeOptionLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm sm:col-span-4">
                  <span className="font-medium">Vieta</span>
                  <select
                    id="correction-location"
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
                    id="correction-gross"
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

      {delivery &&
      activeBatch &&
      activeBatch.receivingMode === "WEIGHT" &&
      savedBag ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Etiketė · Priėmimas {delivery.code}
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
              {PRINT_LABEL}
            </button>
          </div>
        </section>
      ) : null}

      {delivery &&
      activeBatch &&
      activeBatch.receivingMode === "PIECE" &&
      pieceLabel ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Etiketė · {activeBatch.code} · {pieceLabel.resourceName}
            </h2>
            <button
              type="button"
              onClick={closePieceLabel}
              className={SECONDARY_BUTTON_CLASS}
            >
              Uždaryti
            </button>
          </div>
          <PieceLabel label={pieceLabelData(delivery, activeBatch, pieceLabel)} />
          <div>
            <button
              type="button"
              onClick={() => window.print()}
              className={PRIMARY_BUTTON_CLASS}
            >
              {PRINT_LABEL}
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
  href,
}: {
  batch: Batch;
  active: boolean;
  href: string;
}) {
  const content =
    batch.receivingMode === "PIECE"
      ? `${batch.code} · ${batchReceivingModeLabel(batch.receivingMode)}`
      : `${batch.code} · ${batch.resourceName}`;
  return (
    <tr
      className={
        active
          ? "relative border-t border-border bg-accent/40"
          : "relative border-t border-border hover:bg-accent/50 focus-within:bg-accent/50"
      }
    >
      <td className="px-4 py-2 font-medium">
        <Link
          href={href}
          aria-label={`Atidaryti partiją ${batch.code}`}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {content}
          <span aria-hidden="true" className="absolute inset-0" />
        </Link>
      </td>
      <td className="px-4 py-2">{batch.warehouseName}</td>
      <td className="px-4 py-2">
        {batch.receivingMode === "PIECE" ? batch.itemLineCount : batch.bagCount}
      </td>
      <td className="px-4 py-2">
        {batch.receivingMode === "PIECE"
          ? formatPieces(batch.totalPieces)
          : formatWeight(batch.totalNetWeight)}
      </td>
      <td className="px-4 py-2">
        <span className={batchStatusClass(batch.status)}>
          {batchStatusLabel(batch.status)}
        </span>
      </td>
    </tr>
  );
}
