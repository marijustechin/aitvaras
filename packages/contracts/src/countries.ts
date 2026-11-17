import { z } from "zod";
import countries, { type LocaleData } from "i18n-iso-countries";
import lithuanianLocale from "i18n-iso-countries/langs/lt.json";

/** One selectable country: ISO 3166-1 alpha-2 code + Lithuanian display name. */
export interface CountryOption {
  code: string;
  name: string;
}

// The Lithuanian locale ships with the standard ISO 3166-1 dataset. Registering
// it once here keeps the web selector and the API validation on one source.
countries.registerLocale(lithuanianLocale as LocaleData);

const names = countries.getNames("lt");

/**
 * Complete country list, sorted by Lithuanian name. The stored value is always
 * the uppercase alpha-2 code; the name is for display/search only.
 */
export const COUNTRY_OPTIONS: readonly CountryOption[] = Object.freeze(
  Object.entries(names)
    .map(([code, name]) => ({ code, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "lt")),
);

const COUNTRY_CODE_SET = new Set(COUNTRY_OPTIONS.map((country) => country.code));

/** True when `value` is a known uppercase ISO 3166-1 alpha-2 code. */
export function isCountryCode(value: string): boolean {
  return COUNTRY_CODE_SET.has(value);
}

/** Lithuanian display name for a stored country code, or `undefined`. */
export function countryName(
  code: string | null | undefined,
): string | undefined {
  if (!code) {
    return undefined;
  }
  return countries.getName(code.trim().toUpperCase(), "lt") ?? undefined;
}

/**
 * Resolve a stored/legacy country value to a canonical alpha-2 code.
 *
 * Accepts an alpha-2 code (case-insensitive) or a recognizable Lithuanian /
 * English country name. Returns `null` for anything ambiguous or unknown — the
 * caller must not invent a country.
 */
export function canonicalCountryCode(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (COUNTRY_CODE_SET.has(upper)) {
    return upper;
  }
  return (
    countries.getAlpha2Code(trimmed, "lt") ??
    countries.getAlpha2Code(trimmed, "en") ??
    null
  );
}

/** Required ISO alpha-2 country code (normalised to uppercase). */
export const CountryCodeSchema = z
  .string({ error: "Pasirinkite šalį." })
  .trim()
  .min(1, { message: "Pasirinkite šalį." })
  .transform((value) => value.toUpperCase())
  .refine(isCountryCode, { message: "Pasirinkite šalį iš sąrašo." });
