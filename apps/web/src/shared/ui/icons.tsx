/**
 * Small, restrained inline SVG icons.
 *
 * The project has no icon library; existing icons (`PasswordInput`, `UserMenu`)
 * are hand-written inline SVGs with `stroke="currentColor"` and `aria-hidden`.
 * These follow the same convention and are always used **with** a visible text
 * label, so they are decorative and must never carry the accessible name.
 */
function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      {children}
    </svg>
  );
}

export function SaveIcon() {
  return (
    <IconBase>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </IconBase>
  );
}

export function PrinterIcon() {
  return (
    <IconBase>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </IconBase>
  );
}

export function PlusIcon() {
  return (
    <IconBase>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </IconBase>
  );
}
