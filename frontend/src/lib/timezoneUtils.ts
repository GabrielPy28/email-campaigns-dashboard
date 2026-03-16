import * as ct from "countries-and-timezones";

export const UTC_OFFSETS = [
  "UTC-12",
  "UTC-11",
  "UTC-9:30",
  "UTC-9",
  "UTC-8",
  "UTC-7",
  "UTC-6",
  "UTC-5",
  "UTC-4",
  "UTC-3",
  "UTC-2:30",
  "UTC-2",
  "UTC-1",
  "UTC+0",
  "UTC+1",
  "UTC+2",
  "UTC+3",
  "UTC+3:30",
  "UTC+4",
  "UTC+4:30",
  "UTC+5",
  "UTC+5:30",
  "UTC+5:45",
  "UTC+6",
  "UTC+6:30",
  "UTC+7",
  "UTC+8",
  "UTC+8:45",
  "UTC+9",
  "UTC+9:30",
  "UTC+10",
  "UTC+10:30",
  "UTC+11",
  "UTC+12",
  "UTC+13",
  "UTC+13:45",
  "UTC+14",
] as const;

/** Convierte un ID IANA (ej. America/New_York) en nombre legible (ej. New York). */
export function timezoneIdToRegionName(tzId: string): string {
  const parts = tzId.split("/");
  const last = parts[parts.length - 1] ?? tzId;
  return last.replace(/_/g, " ");
}

export interface CountryByOffset {
  code: string;
  name: string;
  /** Regiones/zonas que usan este offset en ese país (ej. "New York", "Los Angeles"). */
  regions: string[];
}

/** Nombres de países/territorios que no deben mostrarse como "región" de otro país (ej. America/Puerto_Rico se usa para varias islas). */
function buildCountryNamesSet(
  countries: Record<string, { name: string }>
): Set<string> {
  const set = new Set<string>();
  for (const c of Object.values(countries)) {
    if (c.name?.trim()) set.add(c.name.trim().toLowerCase());
  }
  return set;
}

export function getCountriesByOffset(offset: string): CountryByOffset[] {
  const result: CountryByOffset[] = [];
  const sign = offset.includes("-") ? -1 : 1;
  const raw = offset.replace("UTC", "").replace("+", "").replace("-", "").trim();
  const [h, m = "0"] = raw.split(":");
  const target = sign * (parseInt(h, 10) * 60 + parseInt(m, 10));

  const countries = ct.getAllCountries() as Record<string, { id: string; name: string; timezones: string[] }>;
  const countryNamesLower = buildCountryNamesSet(countries);

  for (const [code, country] of Object.entries(countries)) {
    const regions: string[] = [];
    for (const tz of country.timezones) {
      const zone = ct.getTimezone(tz);
      if (zone && zone.utcOffset === target) {
        const label = timezoneIdToRegionName(tz);
        if (!label) continue;
        const labelLower = label.trim().toLowerCase();
        if (countryNamesLower.has(labelLower)) continue;
        if (!regions.includes(label)) regions.push(label);
      }
    }
    if (regions.length > 0) {
      result.push({ code, name: country.name, regions: regions.sort() });
    } else {
      const hasAnyTzForOffset = (country.timezones as string[]).some((tz) => {
        const zone = ct.getTimezone(tz);
        return zone && zone.utcOffset === target;
      });
      if (hasAnyTzForOffset) {
        result.push({ code, name: country.name, regions: [] });
      }
    }
  }

  return result;
}
