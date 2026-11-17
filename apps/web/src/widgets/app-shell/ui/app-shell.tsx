"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { RoleKey } from "@aitvaras/contracts";
import { RequireAuth, useAuth } from "@/features/auth";
import { SectionTabsProvider, type SectionTabsValue, ScrollToTop } from "@/shared/ui";
import { AppHeader, type BreadcrumbItem } from "./app-header";
import { DesktopSidebar } from "./app-sidebar";
import {
  activeDestination,
  SECONDARY_PAGE_TITLES,
  visibleNavSections,
  type ActiveDestination,
} from "../model/navigation";

function breadcrumbTrail(
  pathname: string,
  active: ActiveDestination | null,
): BreadcrumbItem[] {
  if (!active) {
    const title = SECONDARY_PAGE_TITLES[pathname];
    return title ? [{ label: title }] : [];
  }
  const { destination, child } = active;
  if (destination.children.length === 0) {
    return [{ label: destination.label }];
  }
  return [
    { label: destination.label, href: destination.href },
    { label: child?.label ?? destination.label },
  ];
}

function sectionTabsValue(
  active: ActiveDestination | null,
): SectionTabsValue | null {
  if (!active || active.destination.children.length === 0) {
    return null;
  }
  return {
    sectionLabel: active.section.label,
    destinationLabel: active.destination.label,
    items: active.destination.children,
    activeHref: active.child?.href ?? null,
  };
}

/**
 * Authenticated application shell.
 *
 * Desktop: persistent dark sidebar (`DesktopSidebar`) plus a compact top bar.
 * Narrow screens: the sidebar becomes a modal drawer opened from the top bar.
 * The remaining width is the main content surface. Contextual child navigation
 * for the active destination is provided to pages through `SectionTabs`.
 *
 * Use on every authenticated page so the shell is not duplicated per page.
 */
export function AppShell({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: RoleKey[];
}) {
  return (
    <RequireAuth roles={roles}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </RequireAuth>
  );
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const sections = visibleNavSections(user.roles);
  const active = activeDestination(sections, pathname);

  return (
    <SectionTabsProvider value={sectionTabsValue(active)}>
      <div className="flex min-h-screen w-full bg-zinc-100">
        <DesktopSidebar sections={sections} pathname={pathname} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            sections={sections}
            pathname={pathname}
            trail={breadcrumbTrail(pathname, active)}
          />
          <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <div className="mx-auto min-h-full w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
        <ScrollToTop />
      </div>
    </SectionTabsProvider>
  );
}
