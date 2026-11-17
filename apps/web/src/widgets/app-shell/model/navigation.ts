import type { RoleKey } from "@aitvaras/contracts";
import { GAVIMAI_ACTION } from "@/entities/batch";

/** Icon identifiers for sidebar destinations (rendered by `NavIcon`). */
export type NavIconKey =
  | "home"
  | "receive"
  | "receipts"
  | "directories"
  | "reports"
  | "system";

/** A horizontal child destination inside one sidebar destination. */
export interface NavChild {
  href: string;
  label: string;
  /** Visible only when the user holds at least one of these roles. */
  requiredRoles?: RoleKey[];
  /** Hidden when the user holds any of these roles. */
  excludeRoles?: RoleKey[];
}

/**
 * A sidebar destination.
 *
 * A destination without `children` is a plain page link. A destination with
 * `children` represents a *section*: the sidebar highlights the parent and the
 * child routes are rendered as contextual horizontal navigation inside the
 * page. The destination `href` is its landing page (normally the first child).
 */
export interface NavDestination {
  id: string;
  href: string;
  label: string;
  icon: NavIconKey;
  /** Visible only when the user holds at least one of these roles. */
  requiredRoles?: RoleKey[];
  /** Hidden when the user holds any of these roles. */
  excludeRoles?: RoleKey[];
  /**
   * Additional routes that keep this destination active (e.g. the receiving
   * workflow lives under `/receiving` while the list lives at `/receipts`).
   */
  activeHrefs?: readonly string[];
  children?: readonly NavChild[];
}

/** A labelled sidebar group ("Operacijos", "Duomenys", ...). */
export interface NavSection {
  id: string;
  label: string;
  items: readonly NavDestination[];
}

/** Visible, role-filtered child. */
export interface VisibleNavChild {
  href: string;
  label: string;
}

/** Visible, role-filtered sidebar destination (children pre-filtered). */
export interface VisibleNavDestination {
  kind: "destination";
  id: string;
  href: string;
  label: string;
  icon: NavIconKey;
  activeHrefs: string[];
  children: VisibleNavChild[];
}

/** Visible, role-filtered sidebar section. */
export interface VisibleNavSection {
  id: string;
  label: string;
  items: VisibleNavDestination[];
}

/** The active destination/child pair for a pathname. */
export interface ActiveDestination {
  section: VisibleNavSection;
  destination: VisibleNavDestination;
  child: VisibleNavChild | null;
}

/**
 * Primary navigation information architecture (application-shell composition,
 * not domain logic).
 *
 * - **Operacijos** — the daily physical/administrative flows stay plain links:
 *   `Suvestinė` and `Priėmimas`. `Priėmimas` is one destination for the
 *   received-batch list (`/receipts`) and the new-receipt workflow
 *   (`/receiving`, `/receiving/new`, delivery/batch detail). There is no
 *   separate `Registruoti sandėlyje` sidebar item.
 * - **Duomenys** — `Žinynai` is one section with reference-data children
 *   (`Partneriai`, `Ištekliai`, `Kategorijos`, `Tara`, `Sandėliai`). The
 *   multi-step reference-data groups stay reachable as horizontal children
 *   instead of being duplicated in the sidebar.
 * - **Administravimas** — `Ataskaitos` (the discrepancy register) and
 *   `Nustatymai` (the operator's company details and user administration).
 *
 * Rule: navigation contains only **implemented and confirmed** functionality. Do
 * not add placeholder links for future business domains.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "operations",
    label: "Operacijos",
    items: [
      { id: "home", href: "/", label: "Suvestinė", icon: "home" },
      {
        id: "receipts",
        href: GAVIMAI_ACTION.href,
        label: GAVIMAI_ACTION.label,
        icon: "receipts",
        activeHrefs: ["/receiving"],
      },
    ],
  },
  {
    id: "data",
    label: "Duomenys",
    items: [
      {
        id: "directories",
        href: "/partners",
        label: "Žinynai",
        icon: "directories",
        children: [
          { href: "/partners", label: "Partneriai" },
          { href: "/resources", label: "Ištekliai" },
          { href: "/resources/categories", label: "Kategorijos" },
          { href: "/resources/packaging-types", label: "Tara" },
          { href: "/warehouses", label: "Sandėliai" },
        ],
      },
    ],
  },
  {
    id: "administration",
    label: "Administravimas",
    items: [
      {
        id: "reports",
        href: "/reports/discrepancies",
        label: "Ataskaitos",
        icon: "reports",
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
        id: "settings",
        href: "/settings/company",
        label: "Nustatymai",
        icon: "system",
        requiredRoles: ["ADMIN"],
        children: [
          {
            href: "/settings/company",
            label: "Įmonė",
            requiredRoles: ["ADMIN"],
          },
          { href: "/admin/users", label: "Naudotojai", requiredRoles: ["ADMIN"] },
        ],
      },
    ],
  },
];

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
 * Role-filtered navigation.
 *
 * A destination with declared children is hidden when none of those children are
 * in scope for the user; a destination without children follows its own role
 * gate. Empty sections are dropped.
 */
export function visibleNavSections(roles: RoleKey[]): VisibleNavSection[] {
  const sections: VisibleNavSection[] = [];

  for (const section of NAV_SECTIONS) {
    const items: VisibleNavDestination[] = [];
    for (const destination of section.items) {
      if (!matchesRoles(destination, roles)) {
        continue;
      }
      const declaredChildren = destination.children ?? [];
      const children = declaredChildren
        .filter((child) => matchesRoles(child, roles))
        .map<VisibleNavChild>((child) => ({
          href: child.href,
          label: child.label,
        }));
      if (declaredChildren.length > 0 && children.length === 0) {
        continue;
      }
      items.push({
        kind: "destination",
        id: destination.id,
        href: destination.href,
        label: destination.label,
        icon: destination.icon,
        activeHrefs: [...(destination.activeHrefs ?? [])],
        children,
      });
    }
    if (items.length > 0) {
      sections.push({ id: section.id, label: section.label, items });
    }
  }

  return sections;
}

/** Whether `href` matches `pathname` exactly or as a parent route. */
export function isPathWithin(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The most specific matching child for a pathname.
 *
 * Child hrefs may nest (e.g. `/resources` and `/resources/categories`). The
 * longest matching href wins so exactly one child is active at a time.
 */
export function activeChild(
  destination: VisibleNavDestination,
  pathname: string,
): VisibleNavChild | null {
  const matches = destination.children.filter((child) =>
    isPathWithin(child.href, pathname),
  );
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((best, child) =>
    child.href.length > best.href.length ? child : best,
  );
}

/** Whether a sidebar destination should read as active for `pathname`. */
export function isDestinationActive(
  destination: VisibleNavDestination,
  pathname: string,
): boolean {
  return (
    isPathWithin(destination.href, pathname) ||
    destination.activeHrefs.some((href) => isPathWithin(href, pathname)) ||
    destination.children.some((child) => isPathWithin(child.href, pathname))
  );
}

/** Resolve the active sidebar section/destination/child for a pathname. */
export function activeDestination(
  sections: readonly VisibleNavSection[],
  pathname: string,
): ActiveDestination | null {
  for (const section of sections) {
    for (const destination of section.items) {
      if (isDestinationActive(destination, pathname)) {
        return {
          section,
          destination,
          child: activeChild(destination, pathname),
        };
      }
    }
  }
  return null;
}

/** Page titles for authenticated routes that are not primary destinations. */
export const SECONDARY_PAGE_TITLES: Readonly<Record<string, string>> = {
  "/profile": "Mano profilis",
};

export const USER_MENU = {
  profile: "Mano profilis",
  logout: "Atsijungti",
} as const;
