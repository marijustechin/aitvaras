"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Partner } from "@aitvaras/contracts";
import { partnerRoleSummary } from "@/entities/partner";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { EMPTY_VALUE, activeStatusLabel, valueOrPlaceholder } from "@/shared/lib/format";
import {
  partnerFormError,
  partnerFormToPayload,
  partnerToFormValues,
  type PartnerFormValues,
} from "../lib/partner-form";
import { PartnerForm } from "./partner-form";

/** Partner details/edit composition (rendered inside the shell). */
export function PartnerDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  const handleError = useCallback(
    (caught: unknown, fallback: string): void => {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setLoadError("Partneris nerastas.");
        return;
      }
      setLoadError(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router],
  );

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setPartner(await apiFetch<Partner>(`/partners/${id}`));
      setLoadError(null);
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti partnerio");
    } finally {
      setLoading(false);
    }
  }, [handleError, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(values: PartnerFormValues): Promise<void> {
    const validation = partnerFormError(values);
    if (validation) {
      setSaveError(validation);
      return;
    }
    setSubmitting(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<Partner>(`/partners/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partnerFormToPayload(values)),
      });
      setPartner(updated);
      setEditing(false);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setSaveError(
        caught instanceof ApiError ? caught.message : "Nepavyko atnaujinti partnerio",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (loadError || !partner) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {loadError ?? "Partneris nerastas."}
        </p>
        <Link href="/partners" className="text-sm hover:underline">
          ← Partneriai
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{partner.name}</h1>
        {isAdmin && !editing ? (
          <button
            type="button"
            onClick={() => {
              setSaveError(null);
              setEditing(true);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Redaguoti
          </button>
        ) : null}
      </div>

      {editing ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <PartnerForm
            initialValues={partnerToFormValues(partner)}
            submitLabel="Išsaugoti"
            submitting={submitting}
            error={saveError}
            onSubmit={(values) => void save(values)}
            onCancel={() => setEditing(false)}
          />
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-6">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Detail label="Vaidmenys" value={partnerRoleSummary(partner.roles)} />
            <Detail label="Būsena" value={activeStatusLabel(partner.active)} />
            <Detail
              label="Įmonės kodas"
              value={valueOrPlaceholder(partner.companyCode)}
            />
            <Detail
              label="PVM kodas"
              value={valueOrPlaceholder(partner.vatCode)}
            />
            <Detail label="Šalis" value={valueOrPlaceholder(partner.country)} />
            <Detail
              label="Adresas"
              value={valueOrPlaceholder(partner.address)}
            />
            <Detail
              label="Kontaktinis asmuo"
              value={valueOrPlaceholder(partner.contactPerson)}
            />
            <Detail label="Telefonas" value={valueOrPlaceholder(partner.phone)} />
            <Detail label="El. paštas" value={valueOrPlaceholder(partner.email)} />
          </dl>
          <div className="mt-6 border-t border-border pt-4">
            <dt className="text-sm font-medium">Pastabos</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {partner.notes && partner.notes.trim() !== ""
                ? partner.notes
                : EMPTY_VALUE}
            </dd>
          </div>
        </section>
      )}

      <Link href="/partners" className="text-sm hover:underline">
        ← Partneriai
      </Link>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm text-muted-foreground">{value}</dd>
    </div>
  );
}
