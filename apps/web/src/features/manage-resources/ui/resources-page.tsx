"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Resource } from "@aitvaras/contracts";
import { EMPTY_RESOURCES_MESSAGE, resourceCategoryLabel } from "@/entities/resource";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel } from "@/shared/lib/format";

/** Resources list composition (rendered inside the application shell). */
export function ResourcesPage() {
  const { user, clearSession } = useAuth();
  const router = useRouter();
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  const reload = useCallback(async (): Promise<void> => {
    try {
      setResources(await apiFetch<Resource[]>("/resources"));
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Nepavyko įkelti išteklių");
    }
  }, [clearSession, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ištekliai</h1>
        {isAdmin ? (
          <Link
            href="/resources/new"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Naujas išteklius
          </Link>
        ) : null}
      </div>

      <div className="-mt-2">
        <Link href="/resources/packing-forms" className="text-sm hover:underline">
          Pakavimo formos
        </Link>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {resources === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : resources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_RESOURCES_MESSAGE}</p>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Pavadinimas</th>
                <th className="px-4 py-2 font-medium">Kategorija</th>
                <th className="px-4 py-2 font-medium">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/resources/${resource.id}`}
                      className="font-medium hover:underline"
                    >
                      {resource.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {resourceCategoryLabel(resource.category)}
                  </td>
                  <td className="px-4 py-2">{activeStatusLabel(resource.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
