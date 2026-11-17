"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Partner } from "@aitvaras/contracts";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { focusField, invalidFieldsSummary } from "@/shared/lib/form-feedback";
import { SectionTabs, useToast } from "@/shared/ui";
import {
  emptyPartnerFormValues,
  partnerFormFieldErrors,
  partnerFormToPayload,
  type PartnerFieldErrors,
  type PartnerFormValues,
} from "../lib/partner-form";
import { partnerFieldErrorsFromApi } from "../lib/partner-api-errors";
import { PartnerForm } from "./partner-form";

/** Create-partner composition (ADMIN; rendered inside the shell). */
export function NewPartnerPage() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<PartnerFieldErrors>({});

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

  async function submit(values: PartnerFormValues): Promise<void> {
    const validation = partnerFormFieldErrors(values);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      announceErrors(validation);
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    try {
      const created = await apiFetch<Partner>("/partners", {
        method: "POST",
        body: JSON.stringify(partnerFormToPayload(values)),
      });
      toast.success("Partneris sukurtas.");
      router.replace(`/partners/${created.id}`);
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
        caught instanceof ApiError ? caught.message : "Nepavyko sukurti partnerio",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Naujas partneris</h1>
      <SectionTabs />
      <section className={workSurfaceClass()}>
        <PartnerForm
          initialValues={emptyPartnerFormValues()}
          submitLabel="Sukurti"
          submitting={submitting}
          fieldErrors={fieldErrors}
          onSubmit={(values) => void submit(values)}
          onCancel={() => router.replace("/partners")}
          onFieldChange={clearFieldError}
        />
      </section>
    </div>
  );
}
