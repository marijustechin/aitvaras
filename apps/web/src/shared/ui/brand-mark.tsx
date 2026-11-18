import Image from 'next/image';
import Link from 'next/link';

/**
 * Aitvaras brand mark.
 *
 * The asset is selected explicitly from the surface it sits on:
 * - `dark` — dark artwork for light backgrounds (e.g. login);
 * - `light` — light artwork for dark backgrounds (e.g. sidebar/drawer).
 *
 * Source assets live in `apps/web/public/brand/` and must not be regenerated,
 * recoloured or replaced without an explicit requirement.
 */
export function BrandMark({
  href,
  className,
  variant = 'dark',
}: {
  readonly href?: string;
  readonly className?: string;
  /** Artwork tone, matching the surrounding background. */
  readonly variant?: 'dark' | 'light';
}) {
  const src =
    variant === 'light'
      ? '/brand/aitvaras-logo-horizontal-light.webp'
      : '/brand/aitvaras-logo-horizontal-dark.webp';
  const mark = (
    <span className={`inline-flex items-center ${className ?? ''}`}>
      <Image
        src={src}
        alt='Aitvaras'
        width={1108}
        height={218}
        priority
        className='h-7 w-auto'
      />
    </span>
  );

  if (!href) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label='Aitvaras'
      className='inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      {mark}
    </Link>
  );
}
