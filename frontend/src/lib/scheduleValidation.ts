import { DateTime } from "luxon";

/** Convierte "UTC-4" -> "UTC-4:00", "UTC+5:30" se mantiene, para que Luxon lo interprete. */
export function toLuxonZone(offset: string): string {
  const m = offset.match(/^UTC([+-])(\d+)(?::(\d+))?$/i);
  if (!m) return offset;
  const sign = m[1];
  const h = m[2];
  const min = m[3] ?? "0";
  return `UTC${sign}${h.padStart(2, "0")}:${min.padEnd(2, "0")}`;
}

/**
 * Valida que la fecha/hora programada sea mayor o igual a la hora actual
 * en la zona horaria indicada (formato UTC±offset, p. ej. "UTC-4", "UTC+5:30").
 */
export function isValidSchedule(
  date: string,
  time: string,
  timezone: string
): boolean {
  const zone = toLuxonZone(timezone);
  const scheduled = DateTime.fromISO(`${date}T${time}`, { zone });
  const now = DateTime.now().setZone(zone);
  return scheduled >= now;
}
