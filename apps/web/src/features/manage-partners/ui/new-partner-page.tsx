"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Partner } from "@aitvaras/contracts";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import {
  emptyPartnerFormValues,
  partnerFormError,
  partnerFormToPayload,
  type PartnerFormValues,
} from "../lib/partner-form";
import { PartnerForm } from "./partner-form";

/** Create-partner composition (ADMIN; rendered inside the shell). */
export function NewPartnerPage() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(values: PartnerFormValues): Promise<void> {
    const validation = partnerFormError(values);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<Partner>("/partners", {
        method: "POST",
        body: JSON.stringify(partnerFormToPayload(values)),
      });
      router.replace(`/partners/${created.id}`);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(
        caught instanceof ApiError ? caught.message : "Nepavyko sukurti partnerio",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Naujas partneris</h1>
      <section className="rounded-xl border border-border bg-card p-6">
        <PartnerForm
          initialValues={emptyPartnerFormValues()}
          submitLabel="Sukurti"
          submitting={submitting}
          error={error}
          onSubmit={(values) => void submit(values)}
          onCancel={() => router.replace("/partners")}
        />
      </section>
    </div>
  );
}
