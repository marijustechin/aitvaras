"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Resource, ResourceCategory } from "@aitvaras/contracts";
import { activeResourceCategories } from "@/entities/resource-category";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { focusField } from "@/shared/lib/form-feedback";
import { SECONDARY_NAV_BUTTON_CLASS, SectionTabs, useToast } from "@/shared/ui";
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
  const toast = useToast();
  const [categories, setCategories] = useState<ResourceCategory[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await apiFetch<ResourceCategory[]>(
          "/resource-categories",
        );
        if (active) {
          setCategories(loaded);
        }
      } catch (caught) {
        if (isUnauthorized(caught)) {
          clearSession();
          router.replace("/login");
          return;
        }
        setLoadError(
          caught instanceof ApiError ? caught.message : "Nepavyko įkelti kategorijų",
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [clearSession, router]);

  async function submit(values: ResourceFormValues): Promise<void> {
    const validation = resourceFormError(values);
    if (validation) {
      toast.error(validation);
      focusField(values.name.trim() === "" ? "resource-name" : "resource-category");
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiFetch<Resource>("/resources", {
        method: "POST",
        body: JSON.stringify(resourceFormToPayload(values)),
      });
      toast.success("Išteklius sukurtas.");
      router.replace(`/resources/${created.id}`);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      toast.error(
        caught instanceof ApiError ? caught.message : "Nepavyko sukurti ištekliaus",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const activeCategories = categories ? activeResourceCategories(categories) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Naujas išteklius</h1>
      <SectionTabs />

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      {categories === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : activeCategories.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Nėra aktyvių kategorijų. Pirmiausia sukurkite kategoriją.
          </p>
          <Link href="/resources/categories" className={SECONDARY_NAV_BUTTON_CLASS}>
            ← Kategorijos
          </Link>
        </div>
      ) : (
        <section className={workSurfaceClass()}>
          <ResourceForm
            categories={categories}
            initialValues={{
              ...emptyResourceFormValues(),
              categoryId: activeCategories[0]?.id ?? "",
            }}
            submitLabel="Sukurti"
            submitting={submitting}
            onSubmit={(values) => void submit(values)}
            onCancel={() => router.replace("/resources")}
          />
        </section>
      )}
    </div>
  );
}
