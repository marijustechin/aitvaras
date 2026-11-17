"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Partner } from "@aitvaras/contracts";
import { partnerCountryName, partnerRoleSummary } from "@/entities/partner";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { EMPTY_VALUE, activeStatusLabel, valueOrPlaceholder } from "@/shared/lib/format";
import { focusField, invalidFieldsSummary } from "@/shared/lib/form-feedback";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { SECONDARY_NAV_BUTTON_CLASS, SectionTabs, useToast } from "@/shared/ui";
import {
  partnerFormFieldErrors,
  partnerFormToPayload,
  partnerToFormValues,
  type PartnerFieldErrors,
  type PartnerFormValues,
} from "../lib/partner-form";
import { partnerFieldErrorsFromApi } from "../lib/partner-api-errors";
import { PartnerForm } from "./partner-form";

/** Partner details/edit composition (rendered inside the shell). */
export function PartnerDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const toast = useToast();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PartnerFieldErrors>({});

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

  function announceErrors(errors: PartnerFieldErrors): void {
    const labels: Record<string, string> = {
      name: "Pavadinimas",
      roles: "Vaidmenys",
      country: "Šalis",
      companyCode: "Įmonės kodas",
    };
    const summary = invalidFieldsSummary(errors, labels);
    if (!summary) {
      return;
    }
    toast.error(summary);
    const first = Object.keys(errors)[0] as keyof PartnerFieldErrors;
    focusField(
      first === "name"
        ? "partner-name"
        : first === "roles"
          ? "partner-role-SUPPLIER"
          : first === "country"
            ? "partner-country"
            : "partner-company-code",
    );
  }

  async function save(values: PartnerFormValues): Promise<void> {
    const validation = partnerFormFieldErrors(values);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      announceErrors(validation);
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      const updated = await apiFetch<Partner>(`/partners/${id}`, {
        method: "PATCH",
        body: JSON.stringify(partnerFormToPayload(values)),
      });
      setPartner(updated);
      setEditing(false);
      toast.success("Partneris atnaujintas.");
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      const apiFieldErrors = partnerFieldErrorsFromApi(caught);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        announceErrors(apiFieldErrors);
        return;
      }
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Nepavyko atnaujinti partnerio",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function clearFieldError(field: keyof PartnerFormValues): void {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field as keyof PartnerFieldErrors];
      if (field === "country" || field === "companyCode") {
        delete next.country;
        delete next.companyCode;
      }
      return next;
    });
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
        <Link href="/partners" className={SECONDARY_NAV_BUTTON_CLASS}>
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
              setFieldErrors({});
              setEditing(true);
            }}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Redaguoti
          </button>
        ) : null}
      </div>

      <SectionTabs />

      {editing ? (
        <section className={workSurfaceClass()}>
          <PartnerForm
            initialValues={partnerToFormValues(partner)}
            submitLabel="Išsaugoti"
            submitting={submitting}
            fieldErrors={fieldErrors}
            onSubmit={(values) => void save(values)}
            onCancel={() => setEditing(false)}
            onFieldChange={clearFieldError}
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
            <Detail
              label="Šalis"
              value={valueOrPlaceholder(partnerCountryName(partner.country))}
            />
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

      <Link href="/partners" className={SECONDARY_NAV_BUTTON_CLASS}>
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
