import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name helper used by shadcn/ui components.
 * Kept in place so generated components work without modification.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
