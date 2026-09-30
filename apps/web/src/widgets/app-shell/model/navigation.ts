import type { RoleKey } from "@aitvaras/contracts";
import {
  GAVIMAI_ACTION,
  RECEIVING_ROLES,
  RECEIVE_ACTION,
} from "@/entities/batch";

export interface NavItem {
  href: string;
  label: string;
  /** Visible only when the user holds at least one of these roles. */
  requiredRoles?: RoleKey[];
  /** Hidden when the user holds any of these roles. */
  excludeRoles?: RoleKey[];
}

/**
 * Primary navigation (application-shell composition, not domain logic).
 *
 * Rule: navigation contains only **implemented and confirmed** functionality.
 * Do not add placeholder links for future business domains.
 *
 * The warehouse worker's navigation exposes the physical receiving action
 * (`Registruoti sandėlyje`) and hides the formal documentary queue (`Gavimai`),
 * which belongs to the administrative process.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Pradžia" },
  { href: "/partners", label: "Partneriai" },
  { href: "/resources", label: "Ištekliai" },
  { href: "/warehouses", label: "Sandėliai" },
  {
    href: RECEIVE_ACTION.href,
    label: RECEIVE_ACTION.label,
    requiredRoles: RECEIVING_ROLES,
  },
  {
    href: GAVIMAI_ACTION.href,
    label: GAVIMAI_ACTION.label,
    excludeRoles: ["WAREHOUSE_WORKER"],
  },
  { href: "/admin/users", label: "Naudotojai", requiredRoles: ["ADMIN"] },
];

export const USER_MENU = {
  profile: "Mano profilis",
  logout: "Atsijungti",
} as const;

/** Navigation items visible to a user with the given roles. */
export function visibleNavItems(roles: RoleKey[]): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (
      item.requiredRoles &&
      !item.requiredRoles.some((role) => roles.includes(role))
    ) {
      return false;
    }
    if (item.excludeRoles?.some((role) => roles.includes(role))) {
      return false;
    }
    return true;
  });
}

/** Whether a navigation item is active for the current pathname. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
