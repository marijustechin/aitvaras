"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { USER_MENU } from "@/lib/navigation";

function ChevronDownIcon() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function UserIcon() {
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
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

/**
 * Current-user menu: shows the person's name and exposes "Mano profilis" and
 * "Atsijungti". Closes on selection, outside click and Escape.
 */
export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const name = `${user.firstName} ${user.lastName}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sm:hidden">
          <UserIcon />
        </span>
        <span className="hidden font-medium sm:inline">{name}</span>
        <ChevronDownIcon />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-sm"
        >
          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="block rounded-sm px-3 py-2 text-sm hover:bg-accent"
          >
            {USER_MENU.profile}
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void logout().then(() => router.replace("/login"));
            }}
            className="block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
          >
            {USER_MENU.logout}
          </button>
        </div>
      ) : null}
    </div>
  );
}
