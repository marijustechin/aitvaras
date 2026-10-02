"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth";
import {
  EMPTY_GROUP_LABEL,
  isNavGroupActive,
  isNavItemActive,
  visibleNavEntries,
  type VisibleNavGroup,
  type VisibleNavLink,
} from "../model/navigation";

function ChevronIcon() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
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
      className="h-4 w-4"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function topLinkClass(active: boolean): string {
  return `inline-flex h-8 items-center rounded-md px-2 text-sm ${
    active
      ? "font-semibold text-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`;
}

function ActiveUnderline() {
  return <span className="absolute inset-x-0 -bottom-1 h-px bg-foreground" />;
}

function NavLink({
  link,
  pathname,
}: {
  link: VisibleNavLink;
  pathname: string;
}) {
  const active = isNavItemActive(link.href, pathname);
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={topLinkClass(active)}
    >
      <span className="relative">
        {link.label}
        {active ? <ActiveUnderline /> : null}
      </span>
    </Link>
  );
}

function GroupTrigger({
  group,
  open,
  active,
  onClick,
}: {
  group: VisibleNavGroup;
  open: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      className={`${topLinkClass(active)} gap-1`}
    >
      <span className="relative">
        {group.label}
        {active ? <ActiveUnderline /> : null}
      </span>
      <ChevronIcon />
    </button>
  );
}

function GroupMenu({ group }: { group: VisibleNavGroup }) {
  return (
    <div
      role="menu"
      className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-md border border-border bg-popover p-1 shadow-sm"
    >
      {group.children.length === 0 ? (
        <span
          role="menuitem"
          aria-disabled="true"
          className="block rounded-sm px-3 py-2 text-sm text-muted-foreground"
        >
          {EMPTY_GROUP_LABEL}
        </span>
      ) : (
        group.children.map((child) => (
          <Link
            key={child.href}
            role="menuitem"
            href={child.href}
            className="block rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {child.label}
          </Link>
        ))
      )}
    </div>
  );
}

/** Role-aware primary navigation: compact desktop bar with grouped dropdowns. */
export function MainNavigation({ className }: { className?: string }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openGroup && !mobileOpen) {
      return;
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);

    function handleOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openGroup, mobileOpen]);

  if (!user) {
    return null;
  }

  const entries = visibleNavEntries(user.roles);

  return (
    <div ref={containerRef} className="min-w-0">
      <nav
        className={`hidden items-center md:flex ${className ?? ""}`}
        aria-label="Pagrindinė navigacija"
      >
        <ul className="flex items-center gap-1">
          {entries.map((entry) =>
            entry.kind === "link" ? (
              <li key={entry.href}>
                <NavLink link={entry} pathname={pathname} />
              </li>
            ) : (
              <li key={entry.id} className="relative">
                <GroupTrigger
                  group={entry}
                  open={openGroup === entry.id}
                  active={isNavGroupActive(entry, pathname)}
                  onClick={() =>
                    setOpenGroup((current) =>
                      current === entry.id ? null : entry.id,
                    )
                  }
                />
                {openGroup === entry.id ? <GroupMenu group={entry} /> : null}
              </li>
            ),
          )}
        </ul>
      </nav>

      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label="Meniu"
          onClick={() => setMobileOpen((current) => !current)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <MenuIcon />
          <span className="font-medium">Meniu</span>
        </button>

        {mobileOpen ? (
          <div
            id="mobile-navigation"
            className="absolute inset-x-0 top-full z-50 border-b border-border bg-background px-4 py-3 shadow-sm"
          >
            <ul className="grid gap-1">
              {entries.map((entry) =>
                entry.kind === "link" ? (
                  <li key={entry.href}>
                    <MobileLink link={entry} pathname={pathname} />
                  </li>
                ) : (
                  <li key={entry.id}>
                    <p className="px-2 pt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {entry.label}
                    </p>
                    {entry.children.length === 0 ? (
                      <p className="px-2 py-1 text-sm text-muted-foreground">
                        {EMPTY_GROUP_LABEL}
                      </p>
                    ) : (
                      <ul className="grid gap-0.5">
                        {entry.children.map((child) => (
                          <li key={child.href}>
                            <MobileLink link={child} pathname={pathname} nested />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileLink({
  link,
  pathname,
  nested = false,
}: {
  link: VisibleNavLink;
  pathname: string;
  nested?: boolean;
}) {
  const active = isNavItemActive(link.href, pathname);
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md py-2 text-sm ${
        nested ? "pl-4 pr-2" : "px-2"
      } ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
    >
      {link.label}
    </Link>
  );
}
