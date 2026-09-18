import Image from "next/image";
import Link from "next/link";

/**
 * Aitvaras brand mark.
 *
 * Responsive by design: the compact symbol is used on narrow viewports and the
 * horizontal logo where horizontal space exists. Only one variant is visible at
 * a time, so screen readers announce the brand once.
 *
 * Source assets live in `apps/web/public/brand/` and must not be regenerated,
 * recoloured or replaced without an explicit requirement.
 */
export function BrandMark({
  href,
  className,
}: {
  href?: string;
  className?: string;
}) {
  const mark = (
    <span className={`inline-flex items-center ${className ?? ""}`}>
      <Image
        src="/brand/aitvaras-logo-horizontal.webp"
        alt="Aitvaras"
        width={1108}
        height={218}
        priority
        className="hidden h-7 w-auto sm:block"
      />
      <Image
        src="/brand/aitvaras-logo-symbol.webp"
        alt="Aitvaras"
        width={512}
        height={512}
        className="h-9 w-9 sm:hidden"
      />
    </span>
  );

  if (!href) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label="Aitvaras"
      className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {mark}
    </Link>
  );
}
