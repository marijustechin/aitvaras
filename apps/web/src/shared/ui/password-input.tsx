"use client";

import { useState } from "react";
import { passwordFieldState } from "@/shared/lib/password-field";

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M9.9 4.24A9.8 9.8 0 0 1 12 4c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.14 4.24M6.6 6.6A17.5 17.5 0 0 0 2 11s3.5 7 10 7a9.8 9.8 0 0 0 3.4-.6" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

/**
 * Password input with an accessible show/hide toggle.
 *
 * Icon semantics match the current state: a crossed-out eye while hidden and an
 * open eye while visible. The toggle is `type="button"` and never submits.
 */
export function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const field = passwordFieldState(visible);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={field.inputType}
        autoComplete={autoComplete}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={field.ariaLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {field.icon === "eye" ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  );
}
