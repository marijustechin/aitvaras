"use client";

import { useState, type FormEvent } from "react";
import {
  RESOURCE_CATEGORY_KEYS,
  RESOURCE_CATEGORY_LABELS,
  type ResourceCategoryKey,
} from "@aitvaras/contracts";
import { activeStatusLabel } from "@/shared/lib/format";
import type { ResourceFormValues } from "../lib/resource-form";

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Reusable create/edit form for a resource. Owns only field state; the parent
 * performs the request, validation messaging and navigation.
 */
export function ResourceForm({
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  initialValues: ResourceFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: ResourceFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ResourceFormValues>(initialValues);

  function set<K extends keyof ResourceFormValues>(
    key: K,
    value: ResourceFormValues[K],
  ): void {
    setValues((current) => ({ ...current, [key]: value }));
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

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Kategorija *</span>
        <select
          value={values.category}
          onChange={(event) =>
            set("category", event.target.value as ResourceCategoryKey)
          }
          className={inputClass}
        >
          {RESOURCE_CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {RESOURCE_CATEGORY_LABELS[key]}
            </option>
          ))}
        </select>
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
              name="resource-active"
              checked={values.active}
              onChange={() => set("active", true)}
            />
            {activeStatusLabel(true)}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="resource-active"
              checked={!values.active}
              onChange={() => set("active", false)}
            />
            {activeStatusLabel(false)}
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
