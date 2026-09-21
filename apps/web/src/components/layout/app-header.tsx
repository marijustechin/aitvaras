"use client";

import { BrandMark } from "@/components/brand-mark";
import { MainNavigation } from "./main-navigation";
import { UserMenu } from "./user-menu";

/** Compact sticky application header for authenticated pages. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <BrandMark href="/" />
        <MainNavigation className="min-w-0" />
        <div className="ml-auto flex items-center">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
