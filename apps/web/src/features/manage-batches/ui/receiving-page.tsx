"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { type IncomingDelivery, type Partner } from "@aitvaras/contracts";
import { formatArrivalDate, RECEIVE_ACTION } from "@/entities/batch";
import { activeSuppliers } from "@/entities/partner";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { PlusIcon, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@/shared/ui";
import {
  createDraftDelivery,
  deliveryFormError,
  toCreateDeliveryPayload,
  type DraftDelivery,
} from "../lib/batch-form";
import {
  EMPTY_DELIVERIES_MESSAGE,
  NEW_DELIVERY_LABEL,
  openReceivingDeliveries,
  OPEN_DELIVERIES_HEADING,
  START_DELIVERY_LABEL,
  type ReceivingMode,
} from "../lib/receiving";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/**
 * Warehouse receiving list (`/receiving`): the **open receiving queue**
 * (`Nepatvirtinti gavimai`) and the `Naujas gavimas` action. Selecting a delivery
 * navigates to its own route (`/receiving/[deliveryId]`); the queue is derived
 * from the deliveries' child batches (see `openReceivingDeliveries`).
 */
export function ReceivingPage() {
  const router = useRouter();
  const { clearSession } = useAuth();

  const [mode, setMode] = useState<ReceivingMode>("choose");
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [deliveries, setDeliveries] = useState<IncomingDelivery[] | null>(null);
  const [draftDelivery, setDraftDelivery] =
    useState<DraftDelivery>(createDraftDelivery);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    let active = true;
    async function load(): Promise<void> {
      try {
        const [partnerList, deliveryList] = await Promise.all([
          apiFetch<Partner[]>("/partners"),
          apiFetch<IncomingDelivery[]>("/deliveries"),
        ]);
        if (!active) {
          return;
        }
        setPartners(partnerList);
        setDeliveries(deliveryList);
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

  function startNewDelivery(): void {
    setMode("new");
    setDraftDelivery(createDraftDelivery());
    setError(null);
  }

  function backToChoose(): void {
    setMode("choose");
    setDraftDelivery(createDraftDelivery());
    setError(null);
  }

  async function submitNewDelivery(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const validation = deliveryFormError(draftDelivery);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<IncomingDelivery>("/deliveries", {
        method: "POST",
        body: JSON.stringify(toCreateDeliveryPayload(draftDelivery)),
      });
      setDraftDelivery(createDraftDelivery());
      router.push(`/receiving/${created.id}`);
    } catch (caught) {
      handleError(caught, "Nepavyko sukurti gavimo");
    } finally {
      setBusy(false);
    }
  }

  const supplierOptions = partners ? activeSuppliers(partners) : [];
  const openDeliveries = deliveries ? openReceivingDeliveries(deliveries) : null;

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

      {mode === "choose" ? (
        <section className="flex flex-col gap-6">
          <button
            type="button"
            onClick={startNewDelivery}
            className={`${PRIMARY_BUTTON_CLASS} w-full px-6 py-4 text-base sm:w-auto`}
          >
            <PlusIcon />
            {NEW_DELIVERY_LABEL}
          </button>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">{OPEN_DELIVERIES_HEADING}</h2>
            {openDeliveries === null ? (
              <p className="text-sm text-muted-foreground">Kraunama…</p>
            ) : openDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {EMPTY_DELIVERIES_MESSAGE}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Gavimas</th>
                      <th className="px-4 py-2 font-medium">Tiekėjas</th>
                      <th className="px-4 py-2 font-medium">Atvykimo data</th>
                      <th className="px-4 py-2 font-medium">Rūšys</th>
                      <th className="px-4 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {openDeliveries.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-2 font-medium">
                          {item.code}
                        </td>
                        <td className="px-4 py-2">{item.supplierName}</td>
                        <td className="whitespace-nowrap px-4 py-2">
                          {formatArrivalDate(item.arrivalDate)}
                        </td>
                        <td className="px-4 py-2">{item.batchCount}</td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/receiving/${item.id}`)
                            }
                            className={SECONDARY_BUTTON_CLASS}
                          >
                            Pasirinkti
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {mode === "new" ? (
        <section className={workSurfaceClass()}>
          <form onSubmit={submitNewDelivery} className="grid gap-4">
            <h2 className="text-lg font-medium">{NEW_DELIVERY_LABEL}</h2>

            <label className="grid gap-1 text-sm sm:max-w-md">
              <span className="font-medium">Tiekėjas</span>
              <select
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
              <input
                required
                type="date"
                value={draftDelivery.arrivalDate}
                onChange={(event) =>
                  setDraftDelivery({
                    ...draftDelivery,
                    arrivalDate: event.target.value,
                  })
                }
                className={inputClass}
              />
            </label>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={backToChoose}
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
      ) : null}
    </div>
  );
}
