const NIGERIA_ALIASES = new Set(["nigeria", "ng", "nga", "federal republic of nigeria"]);

function normalizeCountryLabel(country: string): string {
  return country.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isNigerianFirmCountry(country?: string | null): boolean {
  if (!country) return false;
  const normalized = normalizeCountryLabel(country);
  return NIGERIA_ALIASES.has(normalized) || normalized.includes("nigeria");
}

export function displayCountryName(country?: string | null): string {
  if (!country || !country.trim()) return "not set";
  return isNigerianFirmCountry(country) ? "Nigeria" : country.trim().replace(/\s+/g, " ");
}
