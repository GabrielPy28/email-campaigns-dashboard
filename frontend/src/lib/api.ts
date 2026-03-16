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
  start_date: string;
  end_date: string;
  internal_unique_opens: number;
  internal_total_opens: number;
  internal_total_clicks: number;
  brevo_unique_opens: number;
  brevo_total_opens: number;
  brevo_total_clicks: number;
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
  recipients: RecipientInput[];
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
}

function buildSearchParams(filters: CampaignFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== "") params.set(k, v);
  });
  const q = params.toString();
  return q ? `?${q}` : "";
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
  campaignId: string,
  startDate: string,
  endDate: string
): Promise<BrevoInternalMetricsCompare> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  const res = await fetchWithAuth(
    `/reports/campaigns/${campaignId}/brevo-compare?${params}`
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
