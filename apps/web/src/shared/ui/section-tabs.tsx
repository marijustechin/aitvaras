"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** One contextual child destination (a horizontal tab). */
export interface SectionTab {
  href: string;
  label: string;
}

/**
 * Contextual child navigation for the active sidebar destination.
 *
 * The application shell owns the navigation model and provides this value;
 * feature pages only render the presentational `<SectionTabs />` below their
 * heading. Pages outside a section receive `null` and render nothing.
 */
export interface SectionTabsValue {
  sectionLabel: string;
  destinationLabel: string;
  items: SectionTab[];
  activeHref: string | null;
}

const SectionTabsContext = createContext<SectionTabsValue | null>(null);

export function SectionTabsProvider({
  value,
  children,
}: {
  value: SectionTabsValue | null;
  children: ReactNode;
}) {
  return (
    <SectionTabsContext.Provider value={value}>
      {children}
    </SectionTabsContext.Provider>
  );
}

/**
 * Horizontal child navigation for the current section.
 *
 * Renders below the page heading and above the page content. The tab strip
 * scrolls horizontally within its own container on narrow screens; it never
 * widens the page. `aria-current="page"` marks the active child.
 */
export function SectionTabs({ className }: { className?: string }) {
  const context = useContext(SectionTabsContext);

  if (!context || context.items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={`${context.destinationLabel} skyriai`}
      className={cn(
        "max-w-full overflow-x-auto border-b border-border",
        className,
      )}
    >
      <ul className="flex min-w-max items-stretch gap-1">
        {context.items.map((item) => {
          const active = item.href === context.activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
