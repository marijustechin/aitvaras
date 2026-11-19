"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { IncomingDelivery, Partner } from "@aitvaras/contracts";
import { activeSuppliers } from "@/entities/partner";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { focusField } from "@/shared/lib/form-feedback";
import {
  DateInput,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  useToast,
} from "@/shared/ui";
import {
  createDraftDelivery,
  deliveryFormError,
  toCreateDeliveryPayload,
  type DraftDelivery,
} from "../lib/batch-form";
import {
  DELIVERY_FORM_HEADING,
  NEW_DELIVERY_LABEL,
  START_DELIVERY_LABEL,
} from "../lib/receiving";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/**
 * New-receipt form (`/receiving/new`).
 *
 * Opening this page creates **nothing**: the receipt record is created only when
 * the operator submits `Pradėti priėmimą` (`POST /deliveries`). The started
 * receipt opens at `/receiving/[deliveryId]`, where the first batch is added.
 * `/receiving` itself redirects to the single receiving list at `/receipts`.
 */
export function ReceivingPage() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const toast = useToast();

  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [draftDelivery, setDraftDelivery] =
    useState<DraftDelivery>(createDraftDelivery);
  const [busy, setBusy] = useState(false);

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
    let active = true;
    async function load(): Promise<void> {
      try {
        const partnerList = await apiFetch<Partner[]>("/partners");
        if (active) {
          setPartners(partnerList);
        }
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

  function backToList(): void {
    router.push("/receipts");
  }

  async function submitNewDelivery(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const validation = deliveryFormError(draftDelivery);
    if (validation) {
      toast.error(validation);
      focusField(
        draftDelivery.supplierId.trim() === ""
          ? "delivery-supplier"
          : "delivery-arrival-date",
      );
      return;
    }
    setBusy(true);
    try {
      const created = await apiFetch<IncomingDelivery>("/deliveries", {
        method: "POST",
        body: JSON.stringify(toCreateDeliveryPayload(draftDelivery)),
      });
      setDraftDelivery(createDraftDelivery());
      toast.success(`Priėmimas sukurtas: ${created.code}`);
      router.push(`/receiving/${created.id}`);
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti priėmimo");
    } finally {
      setBusy(false);
    }
  }

  const supplierOptions = partners ? activeSuppliers(partners) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {NEW_DELIVERY_LABEL}
      </h1>

      <section className={workSurfaceClass()}>
        <form onSubmit={submitNewDelivery} noValidate className="grid gap-4">
          <h2 className="text-lg font-medium">{DELIVERY_FORM_HEADING}</h2>

          <label className="grid gap-1 text-sm sm:max-w-md">
            <span className="font-medium">Tiekėjas</span>
            <select
              id="delivery-supplier"
              required
              value={draftDelivery.supplierId}
              onChange={(event) =>
                setDraftDelivery({
                  ...draftDelivery,
                  supplierId: event.target.value,
                })
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

          <label className="grid gap-1 text-sm sm:max-w-xs">
            <span className="font-medium">Atvykimo data</span>
            <DateInput
              id="delivery-arrival-date"
              value={draftDelivery.arrivalDate}
              onChange={(arrivalDate) =>
                setDraftDelivery({
                  ...draftDelivery,
                  arrivalDate,
                })
              }
              required
              className={inputClass}
            />
          </label>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={backToList}
              className={SECONDARY_BUTTON_CLASS}
            >
              Atgal
            </button>
            <button
              type="submit"
              disabled={busy}
              className={PRIMARY_BUTTON_CLASS}
            >
              {busy ? "Kuriama…" : START_DELIVERY_LABEL}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
