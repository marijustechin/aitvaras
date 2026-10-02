"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type {
  Batch,
  ReceivingDiscrepancyDetail,
} from "@aitvaras/contracts";
import {
  formatArrivalDate,
  formatBatchDateTime,
  formatSignedWeight,
  formatWeight,
} from "@/entities/batch";
import {
  discrepancyDirectionClass,
  discrepancyDirectionLabel,
  discrepancyOptionalText,
  discrepancyStatusClass,
  discrepancyStatusLabel,
  EMPTY_SETTLEMENTS_MESSAGE,
  settlementMoneyLabel,
  settlementTypeLabel,
} from "@/entities/receiving-discrepancy";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  SECONDARY_NAV_BUTTON_CLASS,
} from "@/shared/ui";
import { DISCREPANCIES_HREF } from "../lib/discrepancy-list";
import {
  createSettlementDraft,
  settlementFormError,
  toCreateSettlementPayload,
  type SettlementDraft,
} from "../lib/settlement-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

const labelClass = "grid gap-1 text-sm";

/** ADMIN discrepancy detail: immutable origin, derived balance and settlements. */
export function DiscrepancyDetailsPage() {
  const { clearSession } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [detail, setDetail] = useState<ReceivingDiscrepancyDetail | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<SettlementDraft>(createSettlementDraft);
  const [saving, setSaving] = useState(false);

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

  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setDetail(
        await apiFetch<ReceivingDiscrepancyDetail>(
          `/receiving-discrepancies/${id}`,
        ),
      );
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti neatitikimo");
    } finally {
      setLoading(false);
    }
  }, [id, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    async function loadBatches(): Promise<void> {
      try {
        const confirmed = await apiFetch<Batch[]>(
          "/batches?status=CONFIRMED",
        );
        if (active) {
          setBatches(confirmed);
        }
      } catch {
        // The source batch is optional; a failure here must not block the page.
      }
    }
    void loadBatches();
    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<SettlementDraft>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function submitSettlement(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!detail) {
      return;
    }
    const validation = settlementFormError(draft, detail.remainingWeight);
    if (validation) {
      setError(validation);
      setNotice(null);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/receiving-discrepancies/${detail.id}/settlements`, {
        method: "POST",
        body: JSON.stringify(toCreateSettlementPayload(draft)),
      });
      setDraft(createSettlementDraft());
      setNotice("Padengimas užregistruotas.");
      await load();
    } catch (caught) {
      handleError(caught, "Nepavyko užregistruoti padengimo");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-6">
        <Link href={DISCREPANCIES_HREF} className={SECONDARY_NAV_BUTTON_CLASS}>
          ← Neatitikimai
        </Link>
        <p className="text-sm text-muted-foreground">Neatitikimas nerastas.</p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const settled = detail.status === "SETTLED";
  const sourceOptions = batches.filter(
    (batch) =>
      batch.supplierId === detail.supplierId && batch.id !== detail.batchId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={DISCREPANCIES_HREF} className={SECONDARY_NAV_BUTTON_CLASS}>
          ← Neatitikimai
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        Neatitikimas · {detail.deliveryCode} / {detail.batchCode}
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

      <section className={workSurfaceClass()}>
        <h2 className="mb-4 text-lg font-medium">Pradiniai duomenys</h2>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Gavimas" value={detail.deliveryCode} />
          <Field label="Partija" value={detail.batchCode} />
          <Field label="Tiekėjas" value={detail.supplierName} />
          <Field label="Išteklius" value={detail.resourceName} />
          <Field label="Sandėlis" value={detail.warehouseName} />
          <Field label="Atvykimo data" value={formatArrivalDate(detail.arrivalDate)} />
          <Field label="Faktiškai susverta" value={formatWeight(detail.measuredWeight)} />
          <Field
            label="Dokumentuose"
            value={formatWeight(detail.documentWeight)}
          />
          <Field
            label="Skirtumas"
            value={formatSignedWeight(detail.differenceWeight)}
          />
          <Field
            label="Tipas"
            value={
              <span className={discrepancyDirectionClass(detail.direction)}>
                {discrepancyDirectionLabel(detail.direction)}
              </span>
            }
          />
          <Field
            label="Užregistruota"
            value={formatBatchDateTime(detail.createdAt)}
          />
          <Field
            label="Būsena"
            value={
              <span className={discrepancyStatusClass(detail.status)}>
                {discrepancyStatusLabel(detail.status)}
              </span>
            }
          />
        </dl>

        <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-3">
          <Field
            label="Pradinis neatitikimas"
            value={formatWeight(detail.originalWeight)}
          />
          <Field label="Padengta" value={formatWeight(detail.settledWeight)} />
          <Field
            label="Likutis"
            value={
              <span className="font-medium">
                {formatWeight(detail.remainingWeight)}
              </span>
            }
          />
        </dl>
      </section>

      {!settled ? (
        <section className={workSurfaceClass()}>
          <h2 className="mb-4 text-lg font-medium">Registruoti padengimą</h2>
          <form onSubmit={submitSettlement} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-12">
              <label className={`${labelClass} sm:col-span-4`}>
                <span className="font-medium">Būdas</span>
                <select
                  value={draft.type}
                  onChange={(event) =>
                    update({
                      type: event.target.value as SettlementDraft["type"],
                    })
                  }
                  className={inputClass}
                >
                  <option value="WEIGHT">Svoriu</option>
                  <option value="MONEY">Pinigais</option>
                </select>
              </label>
              <label className={`${labelClass} sm:col-span-4`}>
                <span className="font-medium">Padengiamas svoris, kg</span>
                <input
                  required
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  value={draft.coveredWeightKg}
                  onChange={(event) =>
                    update({ coveredWeightKg: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              {draft.type === "WEIGHT" ? (
                <label className={`${labelClass} sm:col-span-4`}>
                  <span className="font-medium">Susijusi partija</span>
                  <select
                    value={draft.sourceBatchId}
                    onChange={(event) =>
                      update({ sourceBatchId: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">— Nepasirinkta —</option>
                    {sourceOptions.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.deliveryCode} / {batch.code} ·{" "}
                        {batch.resourceName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {draft.type === "MONEY" ? (
                <>
                  <label className={`${labelClass} sm:col-span-4`}>
                    <span className="font-medium">Suma</span>
                    <input
                      required
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={draft.moneyAmount}
                      onChange={(event) =>
                        update({ moneyAmount: event.target.value })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={`${labelClass} sm:col-span-4`}>
                    <span className="font-medium">Valiuta</span>
                    <input
                      required
                      type="text"
                      maxLength={8}
                      value={draft.currency}
                      onChange={(event) =>
                        update({ currency: event.target.value })
                      }
                      className={inputClass}
                    />
                  </label>
                </>
              ) : null}
              <label className={`${labelClass} sm:col-span-6`}>
                <span className="font-medium">Nuoroda / dokumento Nr.</span>
                <input
                  type="text"
                  maxLength={255}
                  value={draft.reference}
                  onChange={(event) =>
                    update({ reference: event.target.value })
                  }
                  className={inputClass}
                />
              </label>
              <label className={`${labelClass} sm:col-span-6`}>
                <span className="font-medium">Pastaba</span>
                <input
                  type="text"
                  maxLength={2000}
                  value={draft.note}
                  onChange={(event) => update({ note: event.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Likutis: {formatWeight(detail.remainingWeight)}. Padengimas
              nesikeičia atsargų ar pradinio neatitikimo.
            </p>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className={PRIMARY_BUTTON_CLASS}
              >
                {saving ? "Saugoma…" : "Registruoti padengimą"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="text-sm">
          <span className={discrepancyStatusClass(detail.status)}>
            {discrepancyStatusLabel(detail.status)}
          </span>{" "}
          — neatitikimas visiškai padengtas.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Padengimų istorija</h2>
        {detail.settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {EMPTY_SETTLEMENTS_MESSAGE}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">
                    Data
                  </th>
                  <th className="px-4 py-2 font-medium">Būdas</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">
                    Padengta
                  </th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">
                    Suma
                  </th>
                  <th className="px-4 py-2 font-medium">Susijusi partija</th>
                  <th className="px-4 py-2 font-medium">Nuoroda</th>
                  <th className="px-4 py-2 font-medium">Pastaba</th>
                  <th className="px-4 py-2 font-medium">Registravo</th>
                </tr>
              </thead>
              <tbody>
                {detail.settlements.map((settlement) => (
                  <tr key={settlement.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-2">
                      {formatBatchDateTime(settlement.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      {settlementTypeLabel(settlement.type)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {formatWeight(settlement.coveredWeightKg)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {settlementMoneyLabel(
                        settlement.moneyAmount,
                        settlement.currency,
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {settlement.sourceBatchId
                        ? `${settlement.sourceDeliveryCode ?? ""} / ${
                            settlement.sourceBatchCode ?? ""
                          }`.trim()
                        : discrepancyOptionalText(null)}
                    </td>
                    <td className="px-4 py-2">
                      {discrepancyOptionalText(settlement.reference)}
                    </td>
                    <td className="px-4 py-2">
                      {discrepancyOptionalText(settlement.note)}
                    </td>
                    <td className="px-4 py-2">{settlement.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div>
        <Link href={DISCREPANCIES_HREF} className={SECONDARY_BUTTON_CLASS}>
          ← Neatitikimai
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground">{value}</dd>
    </div>
  );
}
