"use client";

import { useMemo, useRef, useState } from "react";
import type { Resource } from "@aitvaras/contracts";

/**
 * Searchable product selector for the PIECE entry form.
 *
 * Typing filters the existing products by name; selecting an option (mouse,
 * Enter or Arrow keys) stores the product ID. `+ Nauja prekė` remains the
 * explicit creation path outside this control.
 */
export function ProductCombobox({
  id,
  resources,
  value,
  onChange,
  disabled = false,
  inputClassName,
}: {
  id: string;
  resources: readonly Resource[];
  value: string;
  onChange: (resourceId: string) => void;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = resources.find((resource) => resource.id === value) ?? null;
  const effectiveQuery = query === (selected?.name ?? "") ? "" : query;
  const filtered = useMemo(() => {
    const text = effectiveQuery.trim().toLocaleLowerCase("lt-LT");
    if (text === "") {
      return resources;
    }
    return resources.filter((resource) =>
      resource.name.toLocaleLowerCase("lt-LT").includes(text),
    );
  }, [effectiveQuery, resources]);
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const highlightedRef = useRef(highlighted);
  highlightedRef.current = highlighted;
  const displayValue = open ? query : (selected?.name ?? "");

  function choose(resource: Resource): void {
    onChange(resource.id);
    setQuery(resource.name);
    setOpen(false);
    setHighlighted(0);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[highlighted]
            ? `${id}-option-${filtered[highlighted].id}`
            : undefined
        }
        autoComplete="off"
        required
        disabled={disabled}
        value={displayValue}
        onFocus={(event) => {
          setOpen(true);
          setQuery(selected?.name ?? "");
          setHighlighted(0);
          event.currentTarget.select();
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlighted(0);
          if (selected && event.target.value !== selected.name) {
            onChange("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            const length = filteredRef.current.length;
            setHighlighted((current) =>
              Math.min(current + 1, Math.max(0, length - 1)),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((current) => Math.max(0, current - 1));
          } else if (event.key === "Enter") {
            const option = filteredRef.current[highlightedRef.current];
            if (open && option) {
              event.preventDefault();
              choose(option);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery(selected?.name ?? "");
          }
        }}
        placeholder="— Pasirinkti —"
        className={inputClassName}
      />
      {open ? (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nerasta
            </li>
          ) : (
            filtered.map((resource, index) => (
              <li key={resource.id} role="presentation">
                <button
                  type="button"
                  id={`${id}-option-${resource.id}`}
                  role="option"
                  aria-selected={resource.id === value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(resource)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    index === highlighted
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {resource.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
