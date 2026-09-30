import { ean13Modules } from "@/shared/lib/ean13";

/**
 * Renders a scannable EAN-13 barcode (SVG) for a 13-digit value. The barcode is
 * an opaque physical-unit identifier; it is drawn, never parsed for meaning.
 */
export function Ean13Barcode({
  value,
  height = 56,
  moduleWidth = 2,
  className,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
  className?: string;
}) {
  const modules = ean13Modules(value);
  if (!modules) {
    return <p className={className}>{value}</p>;
  }
  const width = modules.length * moduleWidth;
  return (
    <svg
      role="img"
      aria-label={`Brūkšninis kodas ${value}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
    >
      <rect width={width} height={height} fill="#fff" />
      {[...modules].map((bit, index) =>
        bit === "1" ? (
          <rect
            key={index}
            x={index * moduleWidth}
            y={0}
            width={moduleWidth}
            height={height}
            fill="#000"
          />
        ) : null,
      )}
    </svg>
  );
}
