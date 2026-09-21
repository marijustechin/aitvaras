"use client";

import { useState, type FormEvent } from "react";
import { PARTNER_ROLE_KEYS, type PartnerRoleKey } from "@aitvaras/contracts";
import { partnerRoleLabel } from "@/entities/partner";
import type { PartnerFormValues } from "../lib/partner-form";

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Reusable create/edit form for a partner. Owns only field state; the parent
 * performs the request, validation messaging and navigation.
 */
export function PartnerForm({
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initialValues: PartnerFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: PartnerFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PartnerFormValues>(initialValues);

  function set<K extends keyof PartnerFormValues>(
    key: K,
    value: PartnerFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: PartnerRoleKey): void {
    setValues((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((value) => value !== role)
        : [...current.roles, role],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Pavadinimas *</span>
        <input
          required
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          className={inputClass}
        />
      </label>

      <fieldset className="grid gap-2 text-sm">
        <legend className="font-medium">Vaidmenys *</legend>
        <div className="flex flex-wrap gap-4">
          {PARTNER_ROLE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.roles.includes(key)}
                onChange={() => toggleRole(key)}
              />
              {partnerRoleLabel(key)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Įmonės kodas</span>
          <input
            value={values.companyCode}
            onChange={(event) => set("companyCode", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">PVM kodas</span>
          <input
            value={values.vatCode}
            onChange={(event) => set("vatCode", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Šalis</span>
          <input
            value={values.country}
            onChange={(event) => set("country", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Kontaktinis asmuo</span>
          <input
            value={values.contactPerson}
            onChange={(event) => set("contactPerson", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Telefonas</span>
          <input
            value={values.phone}
            onChange={(event) => set("phone", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">El. paštas</span>
          <input
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Adresas</span>
        <input
          value={values.address}
          onChange={(event) => set("address", event.target.value)}
          className={inputClass}
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Pastabos</span>
        <textarea
          rows={3}
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
          className={inputClass}
        />
      </label>

      <fieldset className="grid gap-2 text-sm">
        <legend className="font-medium">Būsena</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="partner-active"
              checked={values.active}
              onChange={() => set("active", true)}
            />
            Aktyvus
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="partner-active"
              checked={!values.active}
              onChange={() => set("active", false)}
            />
            Neaktyvus
          </label>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? "Saugoma…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          Atšaukti
        </button>
      </div>
    </form>
  );
}
