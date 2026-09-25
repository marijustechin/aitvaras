import type { RoleKey } from "@aitvaras/contracts";

export interface NavItem {
  href: string;
  label: string;
  /** Visible only when the user holds at least one of these roles. */
  requiredRoles?: RoleKey[];
}

/**
 * Primary navigation (application-shell composition, not domain logic).
 *
 * Rule: navigation contains only **implemented and confirmed** functionality.
 * Do not add placeholder links for future business domains.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Pradžia" },
  { href: "/partners", label: "Partneriai" },
  { href: "/resources", label: "Ištekliai" },
  { href: "/warehouses", label: "Sandėliai" },
  { href: "/receipts", label: "Pajamavimas" },
  { href: "/admin/users", label: "Naudotojai", requiredRoles: ["ADMIN"] },
];

export const USER_MENU = {
  profile: "Mano profilis",
  logout: "Atsijungti",
} as const;

/** Navigation items visible to a user with the given roles. */
export function visibleNavItems(roles: RoleKey[]): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      !item.requiredRoles ||
      item.requiredRoles.some((role) => roles.includes(role)),
  );
}

/** Whether a navigation item is active for the current pathname. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
