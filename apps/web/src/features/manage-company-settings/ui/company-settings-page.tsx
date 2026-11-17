"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CompanySettings } from "@aitvaras/contracts";
import { isUnauthorized, useAuth } from "@/features/auth";
import { ApiError, apiFetch } from "@/shared/api";
import { focusField, invalidFieldsSummary } from "@/shared/lib/form-feedback";
import { workSurfaceClass } from "@/shared/lib/surfaces";
import { CountrySelect, SectionTabs, useToast } from "@/shared/ui";
import {
  companySettingsFieldErrors,
  companySettingsPayload,
  companySettingsToForm,
  emptyCompanySettingsForm,
  type CompanySettingsField,
  type CompanySettingsFieldErrors,
  type CompanySettingsFormValues,
} from "../lib/company-settings-form";

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const inputErrorClass = "border-destructive";

const FIELD_LABELS: Record<CompanySettingsField, string> = {
  name: "Pavadinimas",
  companyCode: "Įmonės kodas",
  country: "Šalis",
};

const FIELD_IDS: Record<CompanySettingsField, string> = {
  name: "company-name",
  companyCode: "company-company-code",
  country: "company-country",
};

/**
 * Shared operator company details (`Nustatymai` → `Įmonė`).
 *
 * One installation-wide record, deliberately separate from the partner
 * directory. Only an ADMIN route reaches this page; the API also enforces the
 * role on save. The form never invents defaults for saved data.
 */
export function CompanySettingsPage() {
  const router = useRouter();
  const { clearSession } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [values, setValues] = useState<CompanySettingsFormValues>(
    emptyCompanySettingsForm,
  );
  const [fieldErrors, setFieldErrors] = useState<CompanySettingsFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const loaded = await apiFetch<CompanySettings>("/settings/company");
      setSettings(loaded);
      setValues(companySettingsToForm(loaded));
      setLoadError(null);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      setLoadError(
        caught instanceof ApiError
          ? caught.message
          : "Nepavyko įkelti įmonės duomenų",
      );
    } finally {
      setLoading(false);
    }
  }, [clearSession, router]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof CompanySettingsFormValues>(
    key: K,
    value: CompanySettingsFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in FIELD_IDS) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key as CompanySettingsField];
        return next;
      });
    }
  }

  function announceErrors(errors: CompanySettingsFieldErrors): void {
    const summary = invalidFieldsSummary(errors, FIELD_LABELS);
    if (!summary) {
      return;
    }
    toast.error(summary);
    const first = Object.keys(errors)[0] as CompanySettingsField;
    focusField(FIELD_IDS[first]);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const errors = companySettingsFieldErrors(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      announceErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const updated = await apiFetch<CompanySettings>("/settings/company", {
        method: "PUT",
        body: JSON.stringify(companySettingsPayload(values)),
      });
      setSettings(updated);
      setValues(companySettingsToForm(updated));
      toast.success("Įmonės duomenys išsaugoti.");
    } catch (caught) {
      if (isUnauthorized(caught)) {
        clearSession();
        router.replace("/login");
        return;
      }
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Nepavyko išsaugoti įmonės duomenų",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Įmonė</h1>
      <SectionTabs />

      {loading ? (
        <p className="text-sm text-muted-foreground">Kraunama…</p>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Bandyti dar kartą
          </button>
        </div>
      ) : (
        <section className={workSurfaceClass()}>
          <h2 className="text-lg font-medium">Įmonės duomenys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bendra informacija apie įmonę, kurios vardu naudojama sistema.
          </p>
          {settings && settings.updatedAt === null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Duomenys dar neįvesti.
            </p>
          ) : null}

          <form onSubmit={save} noValidate className="mt-4 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Pavadinimas *</span>
                <input
                  id={FIELD_IDS.name}
                  required
                  value={values.name}
                  onChange={(event) => set("name", event.target.value)}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  className={`${inputClass} ${
                    fieldErrors.name ? inputErrorClass : ""
                  }`}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Įmonės kodas *</span>
                <input
                  id={FIELD_IDS.companyCode}
                  required
                  inputMode="text"
                  autoComplete="off"
                  value={values.companyCode}
                  onChange={(event) => set("companyCode", event.target.value)}
                  aria-invalid={fieldErrors.companyCode ? true : undefined}
                  className={`${inputClass} ${
                    fieldErrors.companyCode ? inputErrorClass : ""
                  }`}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">PVM kodas</span>
                <input
                  id="company-vat-code"
                  value={values.vatCode}
                  onChange={(event) => set("vatCode", event.target.value)}
                  className={inputClass}
                />
              </label>
              <CountrySelect
                id={FIELD_IDS.country}
                value={values.country}
                onChange={(code) => set("country", code)}
                error={fieldErrors.country}
              />
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="font-medium">Adresas</span>
                <input
                  id="company-address"
                  value={values.address}
                  onChange={(event) => set("address", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">El. paštas</span>
                <input
                  id="company-email"
                  type="email"
                  value={values.email}
                  onChange={(event) => set("email", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Telefonas</span>
                <input
                  id="company-phone"
                  value={values.phone}
                  onChange={(event) => set("phone", event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Saugoma…" : "Išsaugoti"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
