"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { isNavItemActive, visibleNavItems } from "@/lib/navigation";

/** Role-aware primary navigation. */
export function MainNavigation({ className }: { className?: string }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const items = visibleNavItems(user.roles);

  return (
    <nav className={className} aria-label="Pagrindinė navigacija">
      <ul className="flex items-center gap-1 sm:gap-2">
        {items.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-8 items-center rounded-md px-2 text-sm ${
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-0 -bottom-1 h-px bg-foreground" />
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
