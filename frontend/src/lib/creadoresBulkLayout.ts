import * as XLSX from "xlsx";

/**
 * Plantilla para `POST /creadores/upload` (CSV / XLSX).
 * Cabeceras → minúsculas y snake_case en el servidor.
 *
 * Cuentas por plataforma: `{slug}_username`, `{slug}_url`, `{slug}_followers`,
 * `{slug}_post_count`, `{slug}_picture`, `{slug}_bio`, `{slug}_category` (coma),
 * `{slug}_verified` (true/false/1/0). `slug` = nombre de plataforma normalizado
 * (instagram, tiktok, youtube, … según existan en BD).
 *
 * Misma persona en varias filas: deja `email` vacío para heredar la fila anterior;
 * todas las filas con el mismo email se fusionan en un solo creador.
 *
 * Alias: handle_instagram → instagram_username, handle_tiktok → tiktok_username,
 * youtube_url → youtube_channel_url, vertical → category.
 */
export const CREADORES_BULK_HEADERS = [
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
  "instagram_followers",
  "instagram_post_count",
  "instagram_picture",
  "instagram_bio",
  "instagram_category",
  "instagram_verified",
  "tiktok_followers",
  "tiktok_post_count",
  "tiktok_picture",
  "tiktok_bio",
  "tiktok_category",
  "tiktok_verified",
  "youtube_followers",
  "youtube_post_count",
  "youtube_picture",
  "youtube_bio",
  "youtube_category",
  "youtube_verified",
] as const;

export type CreadorBulkHeader = (typeof CREADORES_BULK_HEADERS)[number];

function rowFromObject(o: Partial<Record<CreadorBulkHeader, string>>): string[] {
  return CREADORES_BULK_HEADERS.map((h) => o[h] ?? "");
}

function csvEscapeCell(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

/** Tres filas: María (completa), continuación misma persona solo TikTok, Juan solo TikTok. */
export const CREADORES_BULK_EXAMPLE_ROWS: string[][] = [
  rowFromObject({
    email: "maria@ejemplo.com",
    first_name: "Maria",
    last_name: "García",
    full_name: "Maria García",
    picture: "https://cdn.ejemplo.com/maria.jpg",
    username: "maria_g",
    instagram_url: "https://www.instagram.com/maria_g",
    tiktok_url: "",
    youtube_channel_url: "https://www.youtube.com/@mariavlogs",
    instagram_username: "maria_g",
    tiktok_username: "",
    youtube_channel: "Maria Vlogs",
    category: "beauty, fashion and tech",
    facebook_page: "https://facebook.com/mariapage",
    personalized_paragraph: "Texto personalizado para correos.",
    max_followers: "",
    main_platform: "",
    status: "activo",
    instagram_followers: "52000",
    instagram_post_count: "120",
    instagram_picture: "",
    instagram_bio: "Creadora de contenido",
    instagram_category: "beauty, lifestyle",
    instagram_verified: "false",
    tiktok_followers: "",
    tiktok_post_count: "",
    tiktok_picture: "",
    tiktok_bio: "",
    tiktok_category: "",
    tiktok_verified: "",
    youtube_followers: "180000",
    youtube_post_count: "45",
    youtube_picture: "",
    youtube_bio: "",
    youtube_category: "vlogs",
    youtube_verified: "true",
  }),
  rowFromObject({
    email: "",
    tiktok_url: "https://www.tiktok.com/@maria_g",
    tiktok_username: "maria_g",
    tiktok_followers: "95000",
    tiktok_post_count: "200",
    tiktok_bio: "Segunda fila: mismo creador (email heredado).",
    tiktok_category: "beauty, trends",
    tiktok_verified: "false",
  }),
  rowFromObject({
    email: "juan@ejemplo.com",
    first_name: "Juan",
    last_name: "Pérez",
    username: "juanp",
    tiktok_url: "https://www.tiktok.com/@juanp",
    tiktok_username: "juanp",
    category: "gaming and tech",
    max_followers: "89000",
    main_platform: "TikTok",
    status: "activo",
    tiktok_followers: "89000",
    tiktok_post_count: "30",
    tiktok_verified: "false",
  }),
];

export function buildCreadoresPlantillaCsv(): string {
  const lines = [
    CREADORES_BULK_HEADERS.join(","),
    ...CREADORES_BULK_EXAMPLE_ROWS.map((row) => row.map(csvEscapeCell).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

export function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCreadoresPlantillaCsv(): void {
  const body = `\ufeff${buildCreadoresPlantillaCsv()}`;
  triggerDownloadBlob(new Blob([body], { type: "text/csv;charset=utf-8;" }), "creadores_plantilla.csv");
}

export function downloadCreadoresPlantillaXlsx(): void {
  const wb = XLSX.utils.book_new();
  const data = [Array.from(CREADORES_BULK_HEADERS), ...CREADORES_BULK_EXAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Creadores");
  XLSX.writeFile(wb, "creadores_plantilla.xlsx");
}
