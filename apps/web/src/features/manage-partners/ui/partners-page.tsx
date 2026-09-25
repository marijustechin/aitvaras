"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Partner } from "@aitvaras/contracts";
import { EMPTY_PARTNERS_MESSAGE, partnerRoleSummary } from "@/entities/partner";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { activeStatusLabel, valueOrPlaceholder } from "@/shared/lib/format";
import { inactiveRowClass } from "@/shared/lib/row-styles";

/** Partners list composition (rendered inside the application shell). */
export function PartnersPage() {
  const { user, clearSession } = useAuth();
  const router = useRouter();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.roles.includes("ADMIN") ?? false;

  const reload = useCallback(async (): Promise<void> => {
    try {
      setPartners(await apiFetch<Partner[]>("/partners"));
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Nepavyko įkelti partnerių");
    }
  }, [clearSession, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Partneriai</h1>
        {isAdmin ? (
          <Link
            href="/partners/new"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Naujas partneris
          </Link>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {partners === null ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_PARTNERS_MESSAGE}</p>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Pavadinimas</th>
                <th className="px-4 py-2 font-medium">Vaidmenys</th>
                <th className="px-4 py-2 font-medium">Įmonės kodas</th>
                <th className="px-4 py-2 font-medium">Šalis</th>
                <th className="px-4 py-2 font-medium">Kontaktinis asmuo</th>
                <th className="px-4 py-2 font-medium">Būsena</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className={`border-t border-border ${inactiveRowClass(partner.active)}`}
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/partners/${partner.id}`}
                      className="font-medium hover:underline"
                    >
                      {partner.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{partnerRoleSummary(partner.roles)}</td>
                  <td className="px-4 py-2">
                    {valueOrPlaceholder(partner.companyCode)}
                  </td>
                  <td className="px-4 py-2">
                    {valueOrPlaceholder(partner.country)}
                  </td>
                  <td className="px-4 py-2">
                    {valueOrPlaceholder(partner.contactPerson)}
                  </td>
                  <td className="px-4 py-2">{activeStatusLabel(partner.active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
