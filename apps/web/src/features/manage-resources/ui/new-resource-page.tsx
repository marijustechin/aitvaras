"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Resource } from "@aitvaras/contracts";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  emptyResourceFormValues,
  resourceFormError,
  resourceFormToPayload,
  type ResourceFormValues,
} from "../lib/resource-form";
import { ResourceForm } from "./resource-form";

/** Create-resource composition (ADMIN; rendered inside the shell). */
export function NewResourcePage() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(values: ResourceFormValues): Promise<void> {
    const validation = resourceFormError(values);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<Resource>("/resources", {
        method: "POST",
        body: JSON.stringify(resourceFormToPayload(values)),
      });
      router.replace(`/resources/${created.id}`);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(
        caught instanceof ApiError ? caught.message : "Nepavyko sukurti ištekliaus",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Naujas išteklius</h1>
      <section className={workSurfaceClass()}>
        <ResourceForm
          initialValues={emptyResourceFormValues()}
          submitLabel="Sukurti"
          submitting={submitting}
          error={error}
          onSubmit={(values) => void submit(values)}
          onCancel={() => router.replace("/resources")}
        />
      </section>
    </div>
  );
}
