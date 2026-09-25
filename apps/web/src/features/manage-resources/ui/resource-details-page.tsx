"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Resource } from "@aitvaras/contracts";
import { resourceCategoryLabel } from "@/entities/resource";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel, valueOrPlaceholder } from "@/shared/lib/format";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import {
  resourceFormError,
  resourceFormToPayload,
  resourceToFormValues,
  type ResourceFormValues,
} from "../lib/resource-form";
import { ResourceForm } from "./resource-form";

/** Resource details/edit composition (rendered inside the shell). */
export function ResourceDetailsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { user, clearSession } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
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
        setLoadError("Išteklius nerastas.");
        return;
      }
      setLoadError(caught instanceof ApiError ? caught.message : fallback);
    },
    [clearSession, router],
  );

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      setResource(await apiFetch<Resource>(`/resources/${id}`));
      setLoadError(null);
    } catch (caught) {
      handleError(caught, "Nepavyko įkelti ištekliaus");
    } finally {
      setLoading(false);
    }
  }, [handleError, id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(values: ResourceFormValues): Promise<void> {
    const validation = resourceFormError(values);
    if (validation) {
      setSaveError(validation);
      return;
    }
    setSubmitting(true);
    setSaveError(null);
    try {
      const updated = await apiFetch<Resource>(`/resources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(resourceFormToPayload(values)),
      });
      setResource(updated);
      setEditing(false);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setSaveError(
        caught instanceof ApiError ? caught.message : "Nepavyko atnaujinti ištekliaus",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Kraunama…</p>;
  }

  if (loadError || !resource) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {loadError ?? "Išteklius nerastas."}
        </p>
        <Link href="/resources" className="text-sm hover:underline">
          ← Ištekliai
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{resource.name}</h1>
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
        <section className={workSurfaceClass()}>
          <ResourceForm
            initialValues={resourceToFormValues(resource)}
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
            <div>
              <dt className="text-sm font-medium">Kategorija</dt>
              <dd className="text-sm text-muted-foreground">
                {resourceCategoryLabel(resource.category)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Būsena</dt>
              <dd className="text-sm text-muted-foreground">
                {activeStatusLabel(resource.active)}
              </dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-border pt-4">
            <dt className="text-sm font-medium">Pastabos</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {valueOrPlaceholder(resource.notes)}
            </dd>
          </div>
        </section>
      )}

      <Link href="/resources" className="text-sm hover:underline">
        ← Ištekliai
      </Link>
    </div>
  );
}
