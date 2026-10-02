"use client";

import Link from "next/link";
import { RECEIVE_ACTION } from "@/entities/batch";
import { useAuth } from "@/features/auth";
import { homeShowsReceivingAction } from "../lib/home";

/**
 * Home page.
 *
 * For the roles that physically receive stock the home is a focused operational
 * workplace: a single prominent action (`Registruoti sandėlyje`) leading into
 * the simplified receiving flow, with no administrative navigation. Other roles
 * keep the generic home content.
 */
export function HomePage() {
  const { user } = useAuth();
  const showReceiving = user ? homeShowsReceivingAction(user.roles) : false;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Sveiki, {user?.firstName}.
      </h1>

      {showReceiving ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <Link
            href={RECEIVE_ACTION.href}
            className="inline-flex items-center rounded-md bg-primary px-6 py-4 text-base font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {RECEIVE_ACTION.label}
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Registruokite atvežtas pakuotes: pasirinkite partiją arba pradėkite
            naują ir suveskite pakuočių svorius.
          </p>
        </section>
      ) : (
        <p className="text-muted-foreground">
          Tai Aitvaro pradžia. Kol kas įgyvendinti naudotojų, partnerių ir
          išteklių moduliai.
        </p>
      )}
    </div>
  );
}
