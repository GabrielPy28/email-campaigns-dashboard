import { LANETA_TOKEN_KEY } from "./auth";

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
}

export async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem(LANETA_TOKEN_KEY);
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}

export interface CampaignListRow {
  id: string;
  name: string;
  sender_name: string;
  subject: string | null;
  preheader: string | null;
  template_name: string | null;
  num_recipients: number;
  sent_at: string | null;
  total_opens: number;
  total_clicks: number;
  open_rate_pct: number;
  click_rate_pct: number;
  status: string;
  created_by: string;
  created_at: string;
  scheduled_at: string | null;
}

export interface CampaignFilters {
  scheduled_at_from?: string;
  scheduled_at_to?: string;
  sender_id?: string;
  sender_name?: string;
  subject?: string;
  preheader?: string;
  created_by?: string;
  created_at_from?: string;
  created_at_to?: string;
  template_id?: string;
  template_name?: string;
  campaign_id?: string;
  campaign_name?: string;
}

export interface CampaignOpenRecipient {
  recipient_id: string;
  email: string;
  opens: number;
  last_opened_at: string | null;
}

export interface CampaignOpensReport {
  campaign_id: string;
  total_recipients: number;
  unique_open_recipients: number;
  total_opens: number;
  recipients: CampaignOpenRecipient[];
}

export interface CampaignClickSummary {
  campaign_id: string;
  total_clicks: number;
}

export interface CampaignRecipientClicks {
  recipient_id: string;
  email: string;
  clicks: number;
}

export interface CampaignClicksByRecipientReport {
  campaign_id: string;
  recipients: CampaignRecipientClicks[];
}

export interface DeviceCount {
  device: string;
  count: number;
}

export interface CampaignDevicesReport {
  campaign_id: string;
  devices: DeviceCount[];
}

export interface LocationCount {
  country_code: string;
  country_name: string;
  count: number;
}

export interface CampaignLocationsReport {
  campaign_id: string;
  locations: LocationCount[];
}

export interface ButtonClicks {
  button_id: string;
  clicks: number;
}

export interface CampaignClicksByButtonReport {
  campaign_id: string;
  buttons: ButtonClicks[];
}

export interface BrevoInternalMetricsCompare {
  campaign_id: string;
  internal_unique_opens: number;
  internal_total_opens: number;
  internal_total_clicks: number;
  brevo_unique_opens: number;
  brevo_total_opens: number;
  brevo_total_clicks: number;
  /** Brevo aggregatedReport (tag + days); no hay equivalente interno sin webhooks */
  brevo_delivered: number;
  brevo_hard_bounces: number;
  brevo_soft_bounces: number;
  brevo_spam_reports: number;
}

export interface TemplateRead {
  id: string;
  name: string | null;
  created_at: string;
}

export interface TemplateDetail extends TemplateRead {
  html_content: string;
}

export interface SenderRead {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface RecipientInput {
  id: string;
  email: string;
  nombre: string;
  username: string;
  [key: string]: unknown;
}

export interface CampaignCreatePayload {
  name: string;
  subject?: string | null;
  preheader?: string | null;
  template_id: string;
  scheduled_at: string;
  timezone: string;
  wait_min_seconds: number;
  wait_max_seconds: number;
  sender_ids: string[];
  /** Exactamente uno: list_id, creator_ids o recipients. */
  list_id?: string | null;
  creator_ids?: string[] | null;
  recipients?: RecipientInput[] | null;
}

export interface CampaignRecipientRead {
  id: string;
  email: string;
  nombre: string;
  username: string;
}

export interface CampaignReadDetail {
  id: string;
  name: string;
  subject: string | null;
  preheader: string | null;
  template_id: string;
  scheduled_at: string;
  timezone: string;
  wait_min_seconds: number;
  wait_max_seconds: number;
  status: string;
  sender_ids: string[];
  list_id: string | null;
  recipients: CampaignRecipientRead[];
}

function buildSearchParams(filters: CampaignFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== "") params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : "";
}

export interface AccountProfileRead {
  id: string;
  platform_id: string;
  platform_nombre: string;
  username: string | null;
  url: string | null;
  picture: string | null;
  bio: string | null;
  followers_count: number;
  post_count: number;
  category: string[];
  is_verified: boolean;
  updated_at: string | null;
}

/** Respuesta de `GET /creadores/` */
export interface CreatorRead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  picture: string | null;
  username: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_channel_url: string | null;
  tiktok_username: string | null;
  instagram_username: string | null;
  youtube_channel: string | null;
  max_followers: number | null;
  /** Plataforma de la cuenta con más seguidores (viene del backend). */
  main_platform: string | null;
  category: string | null;
  facebook_page: string | null;
  personalized_paragraph: string | null;
  status: string;
  num_campaigns: number;
  account_profiles: AccountProfileRead[];
}

export interface PlatformRead {
  id: string;
  nombre: string;
  created_at: string;
}

export interface AccountProfileCreatePayload {
  platform_id: string;
  username?: string | null;
  url?: string | null;
  picture?: string | null;
  bio?: string | null;
  followers_count: number;
  post_count: number;
  category: string[];
  is_verified: boolean;
}

export interface CreatorListFilters {
  search?: string;
  id_contains?: string;
  email_contains?: string;
  first_name_contains?: string;
  last_name_contains?: string;
  username_contains?: string;
  /** Creadores con cuenta en todas las plataformas indicadas (`account_profiles`). */
  platform_ids?: string[];
  facebook_page_contains?: string;
  status?: string;
  min_campaigns?: number;
  max_campaigns?: number;
  skip?: number;
  limit?: number;
}

function buildCreatorListParams(filters: CreatorListFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v == null || v === "") return;
    if (k === "platform_ids" && Array.isArray(v)) {
      v.forEach((id) => {
        if (id != null && String(id).trim() !== "")
          params.append("platform_ids", String(id));
      });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item != null && item !== "") params.append(k, String(item));
      });
      return;
    }
    params.set(k, String(v));
  });
  const q = params.toString();
  return q ? `?${q}` : "";
}

export async function fetchCreators(
  filters: CreatorListFilters = {}
): Promise<CreatorRead[]> {
  const res = await fetchWithAuth(`/creadores/${buildCreatorListParams(filters)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchPlatforms(): Promise<PlatformRead[]> {
  const res = await fetchWithAuth("/creadores/plataformas");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function readApiError(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: string }).msg);
          }
          return JSON.stringify(item);
        })
        .join(", ");
    }
  } catch {
    /* ignore */
  }
  return t || res.statusText || "Error";
}

/** Cuerpo de `POST /creadores/` */
export interface CreatorCreatePayload {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  picture?: string | null;
  username?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_channel_url?: string | null;
  tiktok_username?: string | null;
  instagram_username?: string | null;
  youtube_channel?: string | null;
  max_followers?: number | null;
  category?: string | null;
  facebook_page?: string | null;
  personalized_paragraph?: string | null;
  status?: string;
  account_profiles?: AccountProfileCreatePayload[] | null;
}

export async function registerCreator(payload: CreatorCreatePayload): Promise<CreatorRead> {
  const res = await fetchWithAuth("/creadores/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchCreator(creatorId: string): Promise<CreatorRead> {
  const res = await fetchWithAuth(`/creadores/${encodeURIComponent(creatorId)}`);
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

/** PATCH: mismo cuerpo que alta; campos omitidos no se actualizan en el servidor si usas partial — aquí enviamos el formulario completo. */
export async function updateCreator(
  creatorId: string,
  payload: CreatorCreatePayload
): Promise<CreatorRead> {
  const res = await fetchWithAuth(`/creadores/${encodeURIComponent(creatorId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function deleteCreator(creatorId: string): Promise<void> {
  const res = await fetchWithAuth(`/creadores/${encodeURIComponent(creatorId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export interface CreatorsUploadResult {
  rows_upserted: number;
  skipped_empty_email: number;
  errors: string[];
}

export async function uploadCreatorsFile(file: File): Promise<CreatorsUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithAuth("/creadores/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

/** Filtro por plataforma en cliente: `creators_test` no tiene `account_profiles`; se usan URLs / campos legacy. */
function filterCreatorsByPlatformIds(
  creators: CreatorRead[],
  platformIds: string[],
  platforms: PlatformRead[]
): CreatorRead[] {
  if (platformIds.length === 0) return creators;
  const nombreById = new Map(platforms.map((p) => [p.id, p.nombre]));
  return creators.filter((c) =>
    platformIds.every((pid) => {
      if (c.account_profiles.some((ap) => ap.platform_id === pid)) return true;
      const name = (nombreById.get(pid) ?? "").toLowerCase();
      const t = (s: string | null | undefined) => !!s?.trim();
      if (name.includes("instagram")) return t(c.instagram_url) || t(c.instagram_username);
      if (name.includes("tiktok")) return t(c.tiktok_url) || t(c.tiktok_username);
      if (name.includes("youtube")) return t(c.youtube_channel_url) || t(c.youtube_channel);
      if (name.includes("facebook")) return t(c.facebook_page);
      return false;
    })
  );
}

/** `GET /creadores-test/` — mismos query params que producción excepto plataformas (refinado en cliente). */
export async function fetchCreatorsTest(
  filters: CreatorListFilters = {},
  platforms: PlatformRead[] = []
): Promise<CreatorRead[]> {
  const { platform_ids, ...rest } = filters;
  const q = buildCreatorListParams(rest);
  const res = await fetchWithAuth(`/creadores-test/${q}`);
  if (!res.ok) throw new Error(await readApiError(res));
  let rows: CreatorRead[] = await res.json();
  if (platform_ids && platform_ids.length > 0) {
    rows = filterCreatorsByPlatformIds(rows, platform_ids, platforms);
  }
  if (filters.status === "inactivo") {
    rows = rows.filter((c) => c.status === "inactivo");
  }
  return rows;
}

export async function registerCreatorTest(payload: CreatorCreatePayload): Promise<CreatorRead> {
  const res = await fetchWithAuth("/creadores-test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchCreatorTest(creatorId: string): Promise<CreatorRead> {
  const res = await fetchWithAuth(`/creadores-test/${encodeURIComponent(creatorId)}`);
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function updateCreatorTest(
  creatorId: string,
  payload: CreatorCreatePayload
): Promise<CreatorRead> {
  const res = await fetchWithAuth(`/creadores-test/${encodeURIComponent(creatorId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function deleteCreatorTest(creatorId: string): Promise<void> {
  const res = await fetchWithAuth(`/creadores-test/${encodeURIComponent(creatorId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function uploadCreatorsFileTest(file: File): Promise<CreatorsUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetchWithAuth("/creadores-test/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

/** Respuesta de `GET /listas/` */
export interface ListaRead {
  id: string;
  nombre: string;
  status: string;
  created_at: string;
  created_by: string;
  num_creators: number;
}

export interface ListaListFilters {
  /** Busca en nombre o ID (contiene). */
  search?: string;
  nombre_contains?: string;
  id_contains?: string;
  status?: string;
}

function buildListaListParams(filters: ListaListFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v == null || v === "") return;
    params.set(k, String(v));
  });
  const q = params.toString();
  return q ? `?${q}` : "";
}

export async function fetchListas(filters: ListaListFilters = {}): Promise<ListaRead[]> {
  const q = buildListaListParams(filters);
  const res = await fetchWithAuth(`/listas/${q}`);
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export interface ListaCreatePayload {
  nombre: string;
  status: "activo" | "inactivo";
}

export interface ListaUpdatePayload {
  nombre?: string;
  status?: "activo" | "inactivo";
}

export async function createLista(payload: ListaCreatePayload): Promise<ListaRead> {
  const res = await fetchWithAuth("/listas/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function updateLista(
  listId: string,
  payload: ListaUpdatePayload
): Promise<ListaRead> {
  const res = await fetchWithAuth(`/listas/${encodeURIComponent(listId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function deleteLista(listId: string): Promise<void> {
  const res = await fetchWithAuth(`/listas/${encodeURIComponent(listId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function downloadListaRecipientsExcel(listId: string): Promise<void> {
  const res = await fetchWithAuth(
    `/listas/${encodeURIComponent(listId)}/recipients/export`
  );
  if (!res.ok) throw new Error(await readApiError(res));
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let name = `lista-${listId}.xlsx`;
  const m = cd && /filename="([^"]+)"/.exec(cd);
  if (m) name = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchListaById(listId: string): Promise<ListaRead> {
  const res = await fetchWithAuth(`/listas/${encodeURIComponent(listId)}`);
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchListaRecipients(listId: string): Promise<CreatorRead[]> {
  const res = await fetchWithAuth(
    `/listas/${encodeURIComponent(listId)}/recipients`
  );
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

/** Quita el creador de la lista (no elimina el creador del directorio). */
export async function removeCreatorFromLista(
  listId: string,
  creatorId: string
): Promise<void> {
  const res = await fetchWithAuth(
    `/listas/${encodeURIComponent(listId)}/recipients/${encodeURIComponent(creatorId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(await readApiError(res));
}

/** Respuesta de `POST /listas/{id}/recipients/link` */
export interface LinkCreatorToListaResult {
  list_id: string;
  creator_id: string;
  linked: boolean;
  message: string;
}

/** Asocia un creador existente a una lista (sin duplicar si ya está). */
export async function linkCreatorToLista(
  listId: string,
  creatorId: string
): Promise<LinkCreatorToListaResult> {
  const res = await fetchWithAuth(
    `/listas/${encodeURIComponent(listId)}/recipients/link`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: creatorId }),
    }
  );
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchListasTest(filters: ListaListFilters = {}): Promise<ListaRead[]> {
  const q = buildListaListParams(filters);
  const res = await fetchWithAuth(`/listas-test/${q}`);
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function createListaTest(payload: ListaCreatePayload): Promise<ListaRead> {
  const res = await fetchWithAuth("/listas-test/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function linkCreatorToListaTest(
  listId: string,
  creatorId: string
): Promise<LinkCreatorToListaResult> {
  const res = await fetchWithAuth(
    `/listas-test/${encodeURIComponent(listId)}/recipients/link`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creator_id: creatorId }),
    }
  );
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchCampaigns(filters: CampaignFilters = {}): Promise<CampaignListRow[]> {
  const res = await fetchWithAuth(`/campaigns/${buildSearchParams(filters)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function downloadCampaignsExcel(filters: CampaignFilters = {}): Promise<void> {
  const path = `/campaigns/export/excel${buildSearchParams(filters)}`;
  const res = await fetchWithAuth(path);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "campaigns.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchCampaignOpens(campaignId: string): Promise<CampaignOpensReport> {
  const res = await fetchWithAuth(`/reports/campaigns/${campaignId}/opens`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCampaignClicks(campaignId: string): Promise<CampaignClickSummary> {
  const res = await fetchWithAuth(`/reports/campaigns/${campaignId}/clicks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCampaignClicksByRecipient(
  campaignId: string
): Promise<CampaignClicksByRecipientReport> {
  const res = await fetchWithAuth(
    `/reports/campaigns/${campaignId}/clicks-by-recipient`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCampaignDevices(campaignId: string): Promise<CampaignDevicesReport> {
  const res = await fetchWithAuth(`/reports/campaigns/${campaignId}/devices`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCampaignLocations(campaignId: string): Promise<CampaignLocationsReport> {
  const res = await fetchWithAuth(`/reports/campaigns/${campaignId}/locations`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCampaignClicksByButton(
  campaignId: string
): Promise<CampaignClicksByButtonReport> {
  const res = await fetchWithAuth(
    `/reports/campaigns/${campaignId}/clicks-by-button`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCampaignDetail(campaignId: string): Promise<CampaignReadDetail> {
  const res = await fetchWithAuth(`/campaigns/${campaignId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface CampaignUpdatePayload {
  name?: string | null;
  subject?: string | null;
  preheader?: string | null;
  template_id?: string;
  scheduled_at?: string;
  timezone?: string;
  wait_min_seconds?: number;
  wait_max_seconds?: number;
}

export async function updateCampaign(
  campaignId: string,
  payload: CampaignUpdatePayload
): Promise<void> {
  const res = await fetchWithAuth(`/campaigns/${campaignId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const res = await fetchWithAuth(`/campaigns/${campaignId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    const message = parseDetailMessage(text);
    throw new Error(message);
  }
}

export async function fetchBrevoCompare(
  campaignId: string
): Promise<BrevoInternalMetricsCompare> {
  const res = await fetchWithAuth(
    `/reports/campaigns/${campaignId}/brevo-compare`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTemplates(): Promise<TemplateRead[]> {
  const res = await fetchWithAuth("/templates/");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTemplate(templateId: string): Promise<TemplateDetail> {
  const res = await fetchWithAuth(`/templates/${templateId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createTemplateFromHtml(
  name: string,
  html_content: string
): Promise<TemplateRead> {
  const res = await fetchWithAuth("/templates/from-html", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, html_content }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function parseDetailMessage(text: string): string {
  try {
    const json = JSON.parse(text) as { detail?: string };
    if (typeof json.detail === "string" && json.detail.trim()) return json.detail;
  } catch {
    /* ignore */
  }
  return text || "Error al eliminar la plantilla";
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const res = await fetchWithAuth(`/templates/${templateId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    const message = parseDetailMessage(text);
    if (res.status === 409) throw new Error(message);
    throw new Error(message);
  }
}

export async function downloadTemplateHtml(templateId: string, filename?: string): Promise<void> {
  const res = await fetchWithAuth(`/templates/${templateId}/download`);
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const name =
    filename ||
    res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ||
    `plantilla-${templateId}.html`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export interface TemplateUpdatePayload {
  name?: string | null;
  html_content?: string;
}

export async function updateTemplate(
  templateId: string,
  payload: TemplateUpdatePayload
): Promise<TemplateRead> {
  const res = await fetchWithAuth(`/templates/${templateId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** `POST /campaigns-test/send` — envío inmediato con HTML en cuerpo (plantilla nueva o borrador). */
export interface TestSendRecipientResult {
  email: string;
  recipient_id: string;
  status: string;
  error?: string | null;
}

export interface TestSendResponse {
  campaign_id: string;
  template_id: string;
  num_recipients: number;
  sent: number;
  failed: number;
  campaign_status: string;
  results: TestSendRecipientResult[];
  tracking_note?: string;
}

export interface TestSendPayload {
  subject: string;
  preheader?: string | null;
  template_html: string;
  sender_ids: string[];
  list_test_id?: string | null;
  recipients?: unknown[] | null;
  creator_test_ids?: string[] | null;
}

export async function sendCampaignTest(payload: TestSendPayload): Promise<TestSendResponse> {
  const res = await fetchWithAuth("/campaigns-test/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

/** `POST /campaigns-test/preview` — HTML/asunto/preheader renderizados con un creador de prueba (sin tracking). */
export interface PreviewCampaignTestPayload {
  template_html: string;
  subject: string;
  preheader?: string | null;
  creator_test_id: string;
  sender_id?: string | null;
}

export interface PreviewCampaignTestResponse {
  html: string;
  subject: string;
  preheader: string | null;
}

export async function previewCampaignTest(
  payload: PreviewCampaignTestPayload
): Promise<PreviewCampaignTestResponse> {
  const res = await fetchWithAuth("/campaigns-test/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function fetchSenders(): Promise<SenderRead[]> {
  const res = await fetchWithAuth("/senders/");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface SenderCreatePayload {
  full_name: string;
  email: string;
}

export interface SenderUpdatePayload {
  full_name?: string;
  email?: string;
}

export async function createSender(payload: SenderCreatePayload): Promise<SenderRead> {
  const res = await fetchWithAuth("/senders/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409) throw new Error(text || "Ya existe un remitente con ese correo");
    throw new Error(text || "Error al registrar el remitente");
  }
  return res.json();
}

export async function updateSender(senderId: string, payload: SenderUpdatePayload): Promise<SenderRead> {
  const res = await fetchWithAuth(`/senders/${senderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409) throw new Error(text || "Ya existe otro remitente con ese correo");
    throw new Error(text || "Error al actualizar el remitente");
  }
  return res.json();
}

export async function deleteSender(senderId: string): Promise<void> {
  const res = await fetchWithAuth(`/senders/${senderId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 409) throw new Error(text || "El remitente está en uso en campañas programadas o en ejecución");
    throw new Error(text || "Error al eliminar el remitente");
  }
}

export async function createCampaign(
  payload: CampaignCreatePayload
): Promise<{ id: string; name: string; status: string }> {
  const res = await fetchWithAuth("/campaigns/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
