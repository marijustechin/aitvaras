"use client";

import Link from "next/link";
import { ROLE_LABELS } from "@aitvaras/contracts";
import { useAuth } from "@/features/auth";
import { BrandMark } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import {
  isDestinationActive,
  type VisibleNavSection,
} from "../model/navigation";
import { NavIcon } from "./nav-icons";

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
      className="h-5 w-5"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/**
 * Sidebar contents shared by the persistent desktop rail and the mobile
 * drawer. The sidebar owns no authorization: it only renders the already
 * role-filtered `sections`.
 */
export function SidebarContent({
  sections,
  pathname,
  onNavigate,
  onClose,
}: {
  sections: readonly VisibleNavSection[];
  pathname: string;
  /** Called after a destination is chosen (closes the mobile drawer). */
  onNavigate?: () => void;
  /** When provided, a close control is shown in the header. */
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const roleSummary = user
    ? user.roles.map((role) => ROLE_LABELS[role]).join(" · ")
    : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        <Link
          href="/"
          onClick={onNavigate}
          aria-label="Aitvaras — pradžia"
          className="inline-flex rounded-md bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <BrandMark variant="horizontal" />
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Uždaryti meniu"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Pagrindinė navigacija"
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {sections.map((section) => (
          <div key={section.id} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
              {section.label}
            </p>
            <ul className="grid gap-0.5">
              {section.items.map((destination) => {
                const active = isDestinationActive(destination, pathname);
                return (
                  <li key={destination.id}>
                    <Link
                      href={destination.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                        active
                          ? "bg-white/10 font-medium text-white"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-white"
                        />
                      ) : null}
                      <NavIcon icon={destination.icon} />
                      <span className="truncate">{destination.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {user ? (
        <div className="mt-auto shrink-0 border-t border-white/10 px-4 py-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Prisijungęs
          </p>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {user.firstName} {user.lastName}
          </p>
          {roleSummary ? (
            <p className="truncate text-xs text-zinc-400">{roleSummary}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Persistent desktop sidebar (dark rail). */
export function DesktopSidebar({
  sections,
  pathname,
}: {
  sections: readonly VisibleNavSection[];
  pathname: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 bg-zinc-950 lg:block">
      <SidebarContent sections={sections} pathname={pathname} />
    </aside>
  );
}
