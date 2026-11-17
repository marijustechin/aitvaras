"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { VisibleNavSection } from "../model/navigation";
import { SidebarContent } from "./app-sidebar";
import { UserMenu } from "./user-menu";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** Current section / breadcrumb shown at the left of the top bar. */
function Breadcrumb({ items }: { items: readonly BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Dabartinė vieta" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex min-w-0 items-center gap-2"
          >
            {index > 0 ? (
              <span aria-hidden="true" className="text-zinc-300">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link
                href={item.href}
                className="truncate rounded-sm text-zinc-500 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="truncate font-medium text-foreground"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Collapsible navigation drawer for narrow screens.
 *
 * The drawer is modal: it closes on `Escape`, on backdrop click and after a
 * destination is chosen. Focus moves into the drawer when it opens, is trapped
 * inside it while open, and returns to the trigger when it closes.
 */
function MobileNavigation({
  sections,
  pathname,
}: {
  sections: readonly VisibleNavSection[];
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const drawer = drawerRef.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = (): HTMLElement[] =>
      drawer
        ? Array.from(
            drawer.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => element.offsetParent !== null)
        : [];

    const first = focusables()[0];
    first?.focus();

    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) {
        return;
      }
      const items = focusables();
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) {
        return;
      }
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) {
        previous.focus();
      } else {
        triggerRef.current?.focus();
      }
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Atidaryti meniu"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <MenuIcon />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-zinc-950/60"
          />
          <aside
            id="mobile-navigation"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigacija"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-zinc-950 shadow-2xl outline-none"
          >
            <SidebarContent
              sections={sections}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              onClose={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}

/** Compact sticky top bar: mobile drawer trigger, breadcrumb and user menu. */
export function AppHeader({
  sections,
  pathname,
  trail,
}: {
  sections: readonly VisibleNavSection[];
  pathname: string;
  trail: readonly BreadcrumbItem[];
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4 sm:gap-4 sm:px-6 lg:h-16 lg:px-8">
      <MobileNavigation sections={sections} pathname={pathname} />
      <Breadcrumb items={trail} />
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <UserMenu />
      </div>
    </header>
  );
}
