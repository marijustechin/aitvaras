"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { COUNTRY_OPTIONS, countryName } from "@aitvaras/contracts";
import { cn } from "@/shared/lib/utils";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Searchable, required country picker backed by the ISO 3166-1 dataset.
 *
 * The stored value is always an uppercase alpha-2 code. Free text is only a
 * search query: typing never changes the value, and submitting without choosing
 * an option leaves the form invalid. Search matches Lithuanian names (diacritics
 * ignored) and alpha-2 codes.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  error,
  disabled = false,
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const fieldId = id ?? `country-${generatedId}`;
  const listId = `${fieldId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedName = countryName(value) ?? "";

  const options = useMemo(() => {
    const term = normalize(query.trim());
    if (term === "") {
      return COUNTRY_OPTIONS;
    }
    return COUNTRY_OPTIONS.map((country) => {
      const code = country.code.toLowerCase();
      const score =
        code === term
          ? 0
          : code.startsWith(term)
            ? 1
            : normalize(country.name).includes(term)
              ? 2
              : code.includes(term)
                ? 3
                : null;
      return { country, score };
    })
      .filter(
        (entry): entry is { country: (typeof COUNTRY_OPTIONS)[number]; score: number } =>
          entry.score !== null,
      )
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.country.name.localeCompare(right.country.name, "lt"),
      )
      .map((entry) => entry.country);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const option = listRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${highlighted}"]`,
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  function openList(): void {
    if (disabled) {
      return;
    }
    setQuery("");
    setOpen(true);
  }

  function closeList(): void {
    setOpen(false);
    setQuery("");
  }

  function select(code: string): void {
    onChange(code);
    closeList();
    inputRef.current?.focus();
  }

  function handleChange(input: string): void {
    setQuery(input);
    if (!open) {
      setOpen(true);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlighted((current) =>
        Math.min(current + 1, Math.max(options.length - 1, 0)),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setHighlighted((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (open) {
        event.preventDefault();
        const option = options[highlighted];
        if (option) {
          select(option.code);
        }
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeList();
      }
      return;
    }
    if (event.key === "Tab") {
      closeList();
    }
  }

  return (
    <div className="grid gap-1 text-sm" ref={containerRef}>
      <label htmlFor={fieldId} className="font-medium">
        Šalis *
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={fieldId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[highlighted]
              ? `${fieldId}-option-${options[highlighted].code}`
              : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-required="true"
          autoComplete="off"
          disabled={disabled}
          required
          placeholder={open ? "Ieškoti šalies…" : "Pasirinkite šalį"}
          value={open ? query : selectedName}
          onChange={(event) => handleChange(event.target.value)}
          onClick={() => {
            if (!open) {
              openList();
            }
          }}
          onKeyDown={handleKeyDown}
          className={cn(inputClass, error && "border-destructive")}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>

        {open ? (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Šalys"
            className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Šalis nerasta.
              </li>
            ) : (
              options.map((country, index) => {
                const active = index === highlighted;
                const selected = country.code === value;
                return (
                  <li
                    key={country.code}
                    id={`${fieldId}-option-${country.code}`}
                    role="option"
                    aria-selected={selected}
                    data-option-index={index}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(country.code)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                      selected && "font-medium",
                    )}
                  >
                    <span>{country.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {country.code}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
