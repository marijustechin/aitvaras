"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatDateInput,
  isoDatePart,
  isValidDateOnly,
  monthGrid,
  monthLabel,
  parseDateOnly,
  shiftMonth,
  todayDateOnly,
  WEEKDAY_SHORT_LABELS,
} from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";

const inputBase =
  "w-full rounded-md border border-input bg-background px-3 py-2 pr-16 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function CalendarIcon() {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * Shared date-only input.
 *
 * A native `<input type="date">` renders according to the browser locale, so its
 * visible format cannot be guaranteed. This component uses a text input with a
 * forced `yyyy-mm-dd` display/entry and its own calendar popover. Values are
 * always date-only strings; no timezone conversion is applied to them.
 */
export function DateInput({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  className,
  placeholder = "yyyy-mm-dd",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const initial = parseDateOnly(value) ?? parseDateOnly(todayDateOnly());
    return {
      year: initial?.year ?? new Date().getFullYear(),
      month: initial?.month ?? new Date().getMonth() + 1,
    };
  });

  const today = todayDateOnly();
  const cells = monthGrid(view.year, view.month);

  useEffect(() => {
    if (!open) {
      return;
    }
    const selectedParts = parseDateOnly(value);
    if (selectedParts) {
      setView({ year: selectedParts.year, month: selectedParts.month });
    }

    function handleOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const target =
      dialogRef.current?.querySelector<HTMLButtonElement>(
        'button[data-day][aria-pressed="true"]',
      ) ?? dialogRef.current?.querySelector<HTMLButtonElement>("button[data-day]");
    target?.focus();
  }, [open, view]);

  function selectDay(day: number): void {
    const date = `${view.year}-${String(view.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isValidDateOnly(date)) {
      onChange(date);
    }
    setOpen(false);
    inputRef.current?.focus();
  }

  const valid = value.trim() === "" || isValidDateOnly(value);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-invalid={error || !valid ? true : undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => onChange(formatDateInput(event.target.value))}
        className={cn(
          inputBase,
          (error || !valid) && "border-destructive",
          className,
        )}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {value && !disabled ? (
          <button
            type="button"
            aria-label="Išvalyti datą"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CloseIcon />
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          aria-label="Atidaryti kalendorių"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              const parts = parseDateOnly(value) ?? parseDateOnly(todayDateOnly());
              if (parts) {
                setView({ year: parts.year, month: parts.month });
              }
            }
            setOpen((current) => !current);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <CalendarIcon />
        </button>
      </div>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="Pasirinkti datą"
          className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover p-3 shadow-md"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Ankstesnis mėnuo"
              onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              ‹
            </button>
            <p className="text-sm font-medium capitalize">{monthLabel(view.year, view.month)}</p>
            <button
              type="button"
              aria-label="Kitas mėnuo"
              onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAY_SHORT_LABELS.map((label) => (
              <span
                key={label}
                aria-hidden="true"
                className="py-1 text-[10px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {cells.map((day, index) => {
              if (day === null) {
                return <span key={`blank-${index}`} aria-hidden="true" />;
              }
              const date = `${view.year}-${String(view.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = isoDatePart(value) === date;
              const isToday = today === date;
              return (
                <button
                  key={date}
                  type="button"
                  data-day={date}
                  aria-label={date}
                  aria-pressed={isSelected}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-sm text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected && "bg-primary font-medium text-primary-foreground hover:opacity-90",
                    !isSelected && isToday && "ring-1 ring-border",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(todayDateOnly());
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Šiandien
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Išvalyti
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
