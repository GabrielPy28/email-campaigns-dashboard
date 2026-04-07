import * as XLSX from "xlsx";
import type { CreatorRead } from "./api";
import { triggerDownloadBlob } from "./creadoresBulkLayout";

/** Alineado con `normalize_csv_header` en el servidor (`app/creators/io_helpers.py`). */
export function normalizePlatformSlugForCsv(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
}

const CREATOR_EXPORT_CORE_HEADERS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "full_name",
  "picture",
  "username",
  "instagram_url",
  "tiktok_url",
  "youtube_channel_url",
  "instagram_username",
  "tiktok_username",
  "youtube_channel",
  "category",
  "facebook_page",
  "personalized_paragraph",
  "max_followers",
  "main_platform",
  "status",
  "num_campaigns",
] as const;

const PLATFORM_COL_SUFFIXES = [
  "username",
  "url",
  "picture",
  "bio",
  "followers",
  "post_count",
  "category",
  "verified",
] as const;

function csvEscapeCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function collectSlugs(creators: CreatorRead[]): string[] {
  const s = new Set<string>();
  for (const c of creators) {
    for (const ap of c.account_profiles ?? []) {
      const slug = normalizePlatformSlugForCsv(ap.platform_nombre);
      if (slug) s.add(slug);
    }
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function buildExportHeaders(slugs: string[]): string[] {
  const dyn = slugs.flatMap((slug) =>
    PLATFORM_COL_SUFFIXES.map((suf) => `${slug}_${suf}`)
  );
  return [...CREATOR_EXPORT_CORE_HEADERS, ...dyn];
}

function profilesBySlug(c: CreatorRead): Map<string, NonNullable<CreatorRead["account_profiles"]>[number]> {
  const m = new Map<string, NonNullable<CreatorRead["account_profiles"]>[number]>();
  for (const ap of c.account_profiles ?? []) {
    const slug = normalizePlatformSlugForCsv(ap.platform_nombre);
    if (slug) m.set(slug, ap);
  }
  return m;
}

function staticCell(c: CreatorRead, h: (typeof CREATOR_EXPORT_CORE_HEADERS)[number]): string {
  switch (h) {
    case "id":
      return c.id;
    case "email":
      return c.email ?? "";
    case "first_name":
      return c.first_name ?? "";
    case "last_name":
      return c.last_name ?? "";
    case "full_name":
      return c.full_name ?? "";
    case "picture":
      return c.picture ?? "";
    case "username":
      return c.username ?? "";
    case "instagram_url":
      return c.instagram_url ?? "";
    case "tiktok_url":
      return c.tiktok_url ?? "";
    case "youtube_channel_url":
      return c.youtube_channel_url ?? "";
    case "instagram_username":
      return c.instagram_username ?? "";
    case "tiktok_username":
      return c.tiktok_username ?? "";
    case "youtube_channel":
      return c.youtube_channel ?? "";
    case "category":
      return c.category ?? "";
    case "facebook_page":
      return c.facebook_page ?? "";
    case "personalized_paragraph":
      return c.personalized_paragraph ?? "";
    case "max_followers":
      return c.max_followers != null ? String(c.max_followers) : "";
    case "main_platform":
      return c.main_platform ?? "";
    case "status":
      return c.status ?? "";
    case "num_campaigns":
      return String(c.num_campaigns ?? 0);
    default:
      return "";
  }
}

function creatorToExportRow(c: CreatorRead, headers: string[]): string[] {
  const bySlug = profilesBySlug(c);
  const coreSet = new Set<string>(CREATOR_EXPORT_CORE_HEADERS);
  return headers.map((h) => {
    if (coreSet.has(h)) {
      return staticCell(c, h as (typeof CREATOR_EXPORT_CORE_HEADERS)[number]);
    }
    const m = /^(.+)_(username|url|picture|bio|followers|post_count|category|verified)$/.exec(h);
    if (!m) return "";
    const slug = m[1];
    const suf = m[2] as (typeof PLATFORM_COL_SUFFIXES)[number];
    const ap = bySlug.get(slug);
    if (!ap) return "";
    switch (suf) {
      case "username":
        return ap.username ?? "";
      case "url":
        return ap.url ?? "";
      case "picture":
        return ap.picture ?? "";
      case "bio":
        return ap.bio ?? "";
      case "followers":
        return String(ap.followers_count ?? 0);
      case "post_count":
        return String(ap.post_count ?? 0);
      case "category":
        return (ap.category ?? []).filter(Boolean).join(", ");
      case "verified":
        return ap.is_verified ? "true" : "false";
      default:
        return "";
    }
  });
}

export function buildCreatorsExportCsv(creators: CreatorRead[]): string {
  const slugs = collectSlugs(creators);
  const headers = buildExportHeaders(slugs);
  const lines = [
    headers.join(","),
    ...creators.map((c) =>
      creatorToExportRow(c, headers).map(csvEscapeCell).join(",")
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function exportFilenameBase(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `${prefix}_${stamp}`;
}

export function downloadCreatorsSelectionCsv(
  creators: CreatorRead[],
  filenameBase = "creadores_seleccion"
): void {
  const body = `\ufeff${buildCreatorsExportCsv(creators)}`;
  triggerDownloadBlob(
    new Blob([body], { type: "text/csv;charset=utf-8;" }),
    `${exportFilenameBase(filenameBase)}.csv`
  );
}

export function downloadCreatorsSelectionXlsx(
  creators: CreatorRead[],
  filenameBase = "creadores_seleccion"
): void {
  const slugs = collectSlugs(creators);
  const headers = buildExportHeaders(slugs);
  const data = [headers, ...creators.map((c) => creatorToExportRow(c, headers))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Creadores");
  XLSX.writeFile(wb, `${exportFilenameBase(filenameBase)}.xlsx`);
}
