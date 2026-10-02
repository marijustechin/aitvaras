import type { RoleKey } from "@aitvaras/contracts";
import {
  GAVIMAI_ACTION,
  RECEIVING_ROLES,
  RECEIVE_ACTION,
} from "@/entities/batch";

/** A navigable link (top-level, or a child inside a group). */
export interface NavItem {
  href: string;
  label: string;
  /** Visible only when the user holds at least one of these roles. */
  requiredRoles?: RoleKey[];
  /** Hidden when the user holds any of these roles. */
  excludeRoles?: RoleKey[];
}

/** A top-level menu group that contains child links. */
export interface NavGroup {
  id: string;
  label: string;
  /** Visible only when the user holds at least one of these roles. */
  requiredRoles?: RoleKey[];
  /** Hidden when the user holds any of these roles. */
  excludeRoles?: RoleKey[];
  /** Child links; may be empty while the area is reserved for the future. */
  children: NavItem[];
}

export type NavEntry =
  | ({ kind: "link" } & NavItem)
  | ({ kind: "group" } & NavGroup);

/** Labels for the top-level menu groups (single source of truth). */
export const NAV_GROUP_LABELS = {
  directories: "Žinynai",
  reports: "Ataskaitos",
  system: "Sistema",
} as const;

/** Shown for a group that is reserved but has no child routes yet. */
export const EMPTY_GROUP_LABEL = "Ruošiama";

/**
 * Primary navigation information architecture (application-shell composition,
 * not domain logic).
 *
 * - **Operational workflows stay top-level**: `Pradžia`, `Registruoti sandėlyje`
 *   and `Gavimai` are the daily physical/administrative flows and are not buried
 *   under administration parents.
 * - **`Žinynai`** groups master/reference data (`Partneriai`, `Ištekliai`,
 *   `Sandėliai`).
 * - **`Ataskaitos`** is reserved for reporting/registers — the future discrepancy
 *   register/report navigation belongs here. It has no children yet.
 * - **`Sistema`** groups system administration (`Naudotojai`; later `Nustatymai`
 *   and other system-admin pages).
 *
 * Rule: navigation contains only **implemented and confirmed** functionality. Do
 * not add placeholder links for future business domains (a reserved *group* is
 * allowed; reserved *routes* are not).
 *
 * The warehouse worker's navigation exposes the physical receiving action
 * (`Registruoti sandėlyje`) and hides the formal documentary queue (`Gavimai`)
 * and the administrative groups (`Ataskaitos`, `Sistema`).
 */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { kind: "link", href: "/", label: "Pradžia" },
  {
    kind: "link",
    href: RECEIVE_ACTION.href,
    label: RECEIVE_ACTION.label,
    requiredRoles: RECEIVING_ROLES,
  },
  {
    kind: "link",
    href: GAVIMAI_ACTION.href,
    label: GAVIMAI_ACTION.label,
    excludeRoles: ["WAREHOUSE_WORKER"],
  },
  {
    kind: "group",
    id: "directories",
    label: NAV_GROUP_LABELS.directories,
    children: [
      { href: "/partners", label: "Partneriai" },
      { href: "/resources", label: "Ištekliai" },
      { href: "/warehouses", label: "Sandėliai" },
    ],
  },
  {
    kind: "group",
    id: "reports",
    label: NAV_GROUP_LABELS.reports,
    excludeRoles: ["WAREHOUSE_WORKER"],
    children: [
      {
        href: "/reports/discrepancies",
        label: "Neatitikimai",
        requiredRoles: ["ADMIN"],
      },
    ],
  },
  {
    kind: "group",
    id: "system",
    label: NAV_GROUP_LABELS.system,
    requiredRoles: ["ADMIN"],
    children: [
      { href: "/admin/users", label: "Naudotojai", requiredRoles: ["ADMIN"] },
    ],
  },
];

/** A role-filtered top-level link. */
export interface VisibleNavLink {
  kind: "link";
  href: string;
  label: string;
}

/** A role-filtered top-level group (children pre-filtered by role). */
export interface VisibleNavGroup {
  kind: "group";
  id: string;
  label: string;
  children: VisibleNavLink[];
}

export type VisibleNavEntry = VisibleNavLink | VisibleNavGroup;

function matchesRoles(
  gate: { requiredRoles?: RoleKey[]; excludeRoles?: RoleKey[] },
  roles: RoleKey[],
): boolean {
  if (
    gate.requiredRoles &&
    !gate.requiredRoles.some((role) => roles.includes(role))
  ) {
    return false;
  }
  if (gate.excludeRoles?.some((role) => roles.includes(role))) {
    return false;
  }
  return true;
}

/**
 * Role-filtered navigation. A populated group whose children are all out of
 * scope is hidden entirely; a deliberately empty (reserved) group is still shown.
 */
export function visibleNavEntries(roles: RoleKey[]): VisibleNavEntry[] {
  const entries: VisibleNavEntry[] = [];
  for (const entry of NAV_ENTRIES) {
    if (!matchesRoles(entry, roles)) {
      continue;
    }
    if (entry.kind === "link") {
      entries.push({ kind: "link", href: entry.href, label: entry.label });
      continue;
    }
    const children = entry.children
      .filter((child) => matchesRoles(child, roles))
      .map<VisibleNavLink>((child) => ({
        kind: "link",
        href: child.href,
        label: child.label,
      }));
    if (entry.children.length > 0 && children.length === 0) {
      continue;
    }
    entries.push({
      kind: "group",
      id: entry.id,
      label: entry.label,
      children,
    });
  }
  return entries;
}

/** Whether a link is active for the current pathname. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether any child of a group is active (so the parent reads as active too). */
export function isNavGroupActive(
  group: VisibleNavGroup,
  pathname: string,
): boolean {
  return group.children.some((child) => isNavItemActive(child.href, pathname));
}

export const USER_MENU = {
  profile: "Mano profilis",
  logout: "Atsijungti",
} as const;
