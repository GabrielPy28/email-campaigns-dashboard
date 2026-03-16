import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  fetchCampaigns,
  downloadCampaignsExcel,
  fetchCampaignOpens,
  fetchCampaignClicks,
  fetchCampaignClicksByRecipient,
  fetchCampaignClicksByButton,
  fetchBrevoCompare,
  fetchCampaignDevices,
  fetchCampaignLocations,
  deleteCampaign,
  type CampaignListRow,
  type CampaignFilters,
  type CampaignOpensReport,
  type CampaignClicksByRecipientReport,
  type CampaignDevicesReport,
  type CampaignLocationsReport,
  type CampaignClicksByButtonReport,
  type BrevoInternalMetricsCompare,
  type LocationCount,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineChevronLeft,
  HiOutlinePlus,
  HiOutlineArrowDownTray,
} from "react-icons/hi2";
import { FaEdit, FaRegTrashAlt} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Line,
  ComposedChart,
  CartesianGrid,
} from "recharts";

const PER_PAGE = 50;
const COLORS = ["#6366f1", "#0ea5e9", "#ec4899", "#64748b"];
const CHART_GRID = "rgba(148, 163, 184, 0.25)";
const TOOLTIP_BG = "rgba(255, 255, 255, 0.98)";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatSentAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = d.getDate();
  const month = MESES[d.getMonth()];
  const year = d.getFullYear();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${day} de ${month} del ${year} a las ${h}:${m}`;
}

export function CampanasPage() {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CampaignFilters>({});
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opensReport, setOpensReport] = useState<CampaignOpensReport | null>(null);
  const [clicksTotal, setClicksTotal] = useState<number>(0);
  const [clicksByRecipientReport, setClicksByRecipientReport] =
    useState<CampaignClicksByRecipientReport | null>(null);
  const [clicksByButtonReport, setClicksByButtonReport] =
    useState<CampaignClicksByButtonReport | null>(null);
  const [brevoCompare, setBrevoCompare] = useState<BrevoInternalMetricsCompare | null>(null);
  const [devicesReport, setDevicesReport] = useState<CampaignDevicesReport | null>(null);
  const [locationsReport, setLocationsReport] = useState<CampaignLocationsReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns(filters);
      setCampaigns(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar campañas");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const activeCampaigns = campaigns.filter((c) => c.status === "running" || c.status === "sent");
  const scheduledDraftCampaigns = campaigns.filter(
    (c) => c.status === "scheduled" || c.status === "pending"
  );

  const totalPages = Math.max(1, Math.ceil(activeCampaigns.length / PER_PAGE));
  const paginatedCampaigns = activeCampaigns.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const from = activeCampaigns.length === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, activeCampaigns.length);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedId) {
      setOpensReport(null);
      setClicksTotal(0);
      setClicksByRecipientReport(null);
      setClicksByButtonReport(null);
      setBrevoCompare(null);
      setDevicesReport(null);
      setLocationsReport(null);
      return;
    }
    setLoadingDetail(true);
    const campaign = campaigns.find((c) => c.id === selectedId);
    const sentAt = campaign?.sent_at ? new Date(campaign.sent_at) : new Date();
    const dateStr = sentAt.toISOString().slice(0, 10);

    Promise.all([
      fetchCampaignOpens(selectedId),
      fetchCampaignClicks(selectedId),
      fetchCampaignClicksByRecipient(selectedId),
      fetchCampaignClicksByButton(selectedId),
      fetchBrevoCompare(selectedId, dateStr, dateStr).catch(() => null),
      fetchCampaignDevices(selectedId),
      fetchCampaignLocations(selectedId),
    ])
      .then(([opens, clicks, clicksByRecipient, clicksByButton, brevo, devices, locations]) => {
        setOpensReport(opens);
        setClicksTotal(clicks.total_clicks);
        setClicksByRecipientReport(clicksByRecipient);
        setClicksByButtonReport(clicksByButton ?? null);
        setBrevoCompare(brevo ?? null);
        setDevicesReport(devices);
        setLocationsReport(locations);
      })
      .catch(() => {
        setOpensReport(null);
        setClicksByRecipientReport(null);
        setClicksByButtonReport(null);
        setBrevoCompare(null);
        setDevicesReport(null);
        setLocationsReport(null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedId, campaigns]);

  const [exporting, setExporting] = useState(false);
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await downloadCampaignsExcel(filters);
    } catch {
      setError("Error al descargar Excel");
    } finally {
      setExporting(false);
    }
  };

  const maxRecipientsAll = campaigns.length
    ? Math.max(1, ...campaigns.map((c) => c.num_recipients))
    : 1;
  const selectedCampaign = selectedId ? campaigns.find((c) => c.id === selectedId) : null;
  const maxRecipientsCampaign = selectedCampaign?.num_recipients ?? maxRecipientsAll;

  const handleEditDraft = (id: string) => {
    // Navega al formulario de nueva campaña pasando el ID a editar.
    navigate(`/dashboard/campanas/nueva?edit=${id}`);
  };

  const handleDeleteDraft = async (id: string) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar campaña?",
      text: "Esta acción no se puede revertir. Se eliminarán también sus destinatarios.",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    try {
      await deleteCampaign(id);
      await loadCampaigns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al eliminar la campaña";
      await Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: msg,
        confirmButtonColor: "#7c3aed",
      });
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50 min-h-full">
      <h1 className="text-2xl font-bold text-slate-800">
        <span className="text-indigo-600">Campañas</span>
      </h1>

      {/* Row 1: Gráficos */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">
          <span className="text-indigo-600">Rendimiento</span>
          <span className="text-slate-600"> e </span>
          <span className="text-sky-600">Impacto</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Interno vs Brevo: Aperturas y Clics */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[280px]">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-3">
              Interno vs Brevo (Aperturas y Clics)
            </p>
            {!selectedId ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                Selecciona una campaña
              </div>
            ) : loadingDetail ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
            ) : brevoCompare ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    {
                      name: "Aperturas",
                      Interno: brevoCompare.internal_total_opens,
                      Brevo: brevoCompare.brevo_total_opens,
                    },
                    {
                      name: "Clics",
                      Interno: brevoCompare.internal_total_clicks,
                      Brevo: brevoCompare.brevo_total_clicks,
                    },
                  ]}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#475569", fontSize: 10 }}
                    stroke="#64748b"
                  />
                  <YAxis tick={{ fill: "#475569", fontSize: 10 }} stroke="#64748b" domain={[0, "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: TOOLTIP_BG,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      color: "#1e293b",
                    }}
                    formatter={(value, name) => [`${value}`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => <span className="text-slate-600">{value}</span>}
                  />
                  <Bar dataKey="Interno" fill="#6366f1" radius={[4, 4, 0, 0]} name="Interno" />
                  <Bar dataKey="Brevo" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Brevo" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                Brevo no disponible o sin datos
              </div>
            )}
          </div>

          {/* Dispositivos */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[280px]">
            <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-3">Dispositivos</p>
            {!selectedId ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                Selecciona una campaña
              </div>
            ) : loadingDetail ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
            ) : devicesReport && devicesReport.devices.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={devicesReport.devices}
                    dataKey="count"
                    nameKey="device"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    stroke="rgba(15,23,42,0.6)"
                  >
                    {devicesReport.devices.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }}
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => <span className="text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
            )}
          </div>

          {/* Aperturas por país */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[280px]">
            <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-3">
              Aperturas por país
            </p>
            {!selectedId ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                Selecciona una campaña
              </div>
            ) : loadingDetail ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
            ) : locationsReport && locationsReport.locations.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={locationsReport.locations.slice(0, 6)}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[1, maxRecipientsCampaign]}
                    tick={{ fill: "#475569", fontSize: 10 }}
                    stroke="#64748b"
                  />
                  <YAxis
                    type="category"
                    dataKey="country_code"
                    width={36}
                    tick={{ fill: "#475569", fontSize: 10 }}
                    stroke="#64748b"
                  />
                  <Tooltip
                    contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-lg text-slate-700"
                          style={{ background: TOOLTIP_BG }}
                        >
                          <span>
                            {(payload[0].payload as LocationCount).country_name ||
                              (payload[0].payload as LocationCount).country_code}
                          </span>
                          <span className="text-indigo-600 font-semibold ml-2">{payload[0].value}</span>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Aperturas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
            )}
          </div>

          {/* Benchmarking: clics por botón de la plantilla */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[280px]">
            <p className="text-xs font-medium text-violet-600 uppercase tracking-wider mb-3">
              Benchmarking (Clics por botón)
            </p>
            {!selectedId ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                Selecciona una campaña
              </div>
            ) : loadingDetail ? (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
            ) : clicksByButtonReport && clicksByButtonReport.buttons.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={clicksByButtonReport.buttons.map((b) => ({
                    name: b.button_id.length > 14 ? `${b.button_id.slice(0, 12)}…` : b.button_id,
                    clicks: b.clicks,
                  }))}
                  margin={{ top: 8, right: 12, left: 0, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#475569", fontSize: 10 }}
                    stroke="#64748b"
                    angle={-35}
                    textAnchor="end"
                    height={44}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 10 }}
                    stroke="#64748b"
                    label={{ value: "Clics", angle: -90, position: "insideLeft", fill: "#475569", fontSize: 10 }}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }}
                    formatter={(value: number) => [value, "Clics"]}
                    labelFormatter={(label) => `Botón: ${label}`}
                  />
                  <Bar dataKey="clicks" fill="#ec4899" radius={[4, 4, 0, 0]} name="Clics" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                Sin clics por botón
              </div>
            )}
          </div>
        </div>

        {/* Aperturas | Clicks por Recipiente (barras verticales + línea) */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-3">
            Aperturas | Clicks por Recipiente
          </p>
          {!selectedId ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              Selecciona una campaña para ver aperturas y clics por destinatario
            </div>
          ) : loadingDetail ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
          ) : opensReport && clicksByRecipientReport && opensReport.recipients.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={(() => {
                  const clicksMap = new Map(
                    clicksByRecipientReport.recipients.map((r) => [r.recipient_id, r.clicks])
                  );
                  return opensReport.recipients
                    .map((r) => ({
                      name: r.email.length > 24 ? `${r.email.slice(0, 22)}…` : r.email,
                      opens: r.opens,
                      clicks: clicksMap.get(r.recipient_id) ?? 0,
                    }))
                    .slice(0, 20);
                })()}
                margin={{ top: 8, right: 24, left: 8, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#475569", fontSize: 10 }}
                  stroke="#64748b"
                  angle={-35}
                  textAnchor="end"
                  height={56}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#475569", fontSize: 10 }}
                  stroke="#64748b"
                  domain={[0, "auto"]}
                />
                <Tooltip
                  contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }}
                  formatter={(value: number, name: string) => [value, name === "opens" ? "Aperturas" : "Clics"]}
                  labelFormatter={(label) => `Recipient: ${label}`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => (
                    <span className="text-slate-600">
                      {value === "opens" ? "Aperturas" : value === "clicks" ? "Clics" : value}
                    </span>
                  )}
                />
                <Bar
                  dataKey="clicks"
                  fill="#ec4899"
                  radius={[4, 4, 0, 0]}
                  name="clicks"
                />
                <Line
                  type="monotone"
                  dataKey="opens"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: "#6366f1", r: 3 }}
                  name="opens"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* Row 2: Accordion filtros + botones */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              filtersOpen
                ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-200"
            )}
          >
            {filtersOpen ? (
              <HiOutlineChevronDown className="h-4 w-4" />
            ) : (
              <HiOutlineChevronRight className="h-4 w-4" />
            )}
            Filtros
          </button>
          <Link to="/dashboard/campanas/nueva">
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="gap-2 text-violet-600 hover:bg-violet-50 hover:text-violet-700 border border-violet-200 bg-white"
            >
              <HiOutlinePlus className="h-4 w-4" />
              Nueva campaña
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="default"
            className="gap-2 text-sky-600 hover:bg-sky-50 hover:text-sky-700 border border-sky-200 bg-white"
            onClick={handleExportExcel}
            disabled={exporting}
          >
            <HiOutlineArrowDownTray className="h-4 w-4" />
            {exporting ? "Descargando…" : "Descargar Excel"}
          </Button>
        </div>

        {filtersOpen && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <FilterInput
                label="Envío desde"
                type="date"
                value={filters.scheduled_at_from ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, scheduled_at_from: v || undefined }))}
              />
              <FilterInput
                label="Envío hasta"
                type="date"
                value={filters.scheduled_at_to ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, scheduled_at_to: v || undefined }))}
              />
              <FilterInput
                label="Sender (ID o nombre)"
                value={filters.sender_name ?? filters.sender_id ?? ""}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    sender_id: /^[0-9a-f-]{36}$/i.test(v) ? v : undefined,
                    sender_name: /^[0-9a-f-]{36}$/i.test(v) ? undefined : v || undefined,
                  }))
                }
              />
              <FilterInput
                label="Asunto"
                value={filters.subject ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, subject: v || undefined }))}
              />
              <FilterInput
                label="Preheader"
                value={filters.preheader ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, preheader: v || undefined }))}
              />
              <FilterInput
                label="Creado por"
                value={filters.created_by ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, created_by: v || undefined }))}
              />
              <FilterInput
                label="Creado desde"
                type="date"
                value={filters.created_at_from ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, created_at_from: v || undefined }))}
              />
              <FilterInput
                label="Creado hasta"
                type="date"
                value={filters.created_at_to ?? ""}
                onChange={(v) => setFilters((f) => ({ ...f, created_at_to: v || undefined }))}
              />
              <FilterInput
                label="Plantilla (ID o nombre)"
                value={filters.template_name ?? filters.template_id ?? ""}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    template_id: /^[0-9a-f-]{36}$/i.test(v) ? v : undefined,
                    template_name: /^[0-9a-f-]{36}$/i.test(v) ? undefined : v || undefined,
                  }))
                }
              />
              <FilterInput
                label="Campaña (ID o nombre)"
                value={filters.campaign_name ?? filters.campaign_id ?? ""}
                onChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    campaign_id: /^[0-9a-f-]{36}$/i.test(v) ? v : undefined,
                    campaign_name: /^[0-9a-f-]{36}$/i.test(v) ? undefined : v || undefined,
                  }))
                }
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => setFilters({})}
                className="text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-slate-200 bg-white"
              >
                Limpiar filtros
              </Button>
              <Button
                size="default"
                onClick={loadCampaigns}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Tabla */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {error && (
          <div className="p-4 text-rose-600 text-sm">{error}</div>
        )}
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando campañas…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="p-3 font-medium text-violet-600">ID</th>
                  <th className="p-3 font-medium text-violet-600">Nombre</th>
                  <th className="p-3 font-medium text-violet-600">Sender</th>
                  <th className="p-3 font-medium text-violet-600">Asunto</th>
                  <th className="p-3 font-medium text-violet-600">Preheader</th>
                  <th className="p-3 font-medium text-violet-600">Recipients</th>
                  <th className="p-3 font-medium text-violet-600">Status</th>
                  <th className="p-3 font-medium text-violet-600">Sent at</th>
                  <th className="p-3 font-medium text-violet-600">Aperturas</th>
                  <th className="p-3 font-medium text-violet-600">Clics</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCampaigns.map((c) => {
                  const isClickable = true;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => isClickable && setSelectedId(selectedId === c.id ? null : c.id)}
                      className={cn(
                        "border-b border-slate-200 transition-colors",
                        isClickable && "hover:bg-slate-50 cursor-pointer",
                        !isClickable && "cursor-default opacity-75",
                        selectedId === c.id && "bg-indigo-50 border-l-4 border-l-indigo-500"
                      )}
                    >
                      <td className="p-3 text-slate-600 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                      <td className="p-3 text-slate-800 font-medium">{c.name}</td>
                      <td className="p-3 text-slate-600">{c.sender_name}</td>
                      <td className="p-3 text-slate-600 max-w-[120px] truncate" title={c.subject ?? ""}>
                        {c.subject ?? "—"}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[100px] truncate" title={c.preheader ?? ""}>
                        {c.preheader ?? "—"}
                      </td>
                      <td className="p-3 text-slate-600">{c.num_recipients}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                            c.status === "sent" && "bg-emerald-100 text-emerald-800",
                            c.status === "running" && "bg-amber-100 text-amber-800",
                            c.status === "scheduled" && "bg-slate-100 text-slate-600",
                            c.status === "failed" && "bg-rose-100 text-rose-800",
                            (c.status === "sending" || c.status === "pending") && "bg-sky-100 text-sky-700",
                            !["sent", "running", "scheduled", "failed", "sending", "pending"].includes(c.status) && "bg-slate-100 text-slate-600"
                          )}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{formatSentAt(c.sent_at)}</td>
                      <td className="p-3 text-slate-600">
                        {c.total_opens} ({c.open_rate_pct}%)
                      </td>
                      <td className="p-3 text-slate-600">
                        {c.total_clicks} ({c.click_rate_pct}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && activeCampaigns.length === 0 && (
          <div className="p-8 text-center text-slate-500">No hay campañas con los filtros aplicados.</div>
        )}
        {!loading && activeCampaigns.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
            <span className="text-slate-600">
              Mostrando <span className="font-medium text-indigo-600">{from}–{to}</span> de <span className="font-medium text-sky-600">{activeCampaigns.length}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="gap-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 h-9 px-3"
              >
                <HiOutlineChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="min-w-[8rem] text-center">
                <span className="text-violet-600 font-medium">Página {page}</span>
                <span className="text-slate-500"> de </span>
                <span className="text-pink-600 font-medium">{totalPages}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="gap-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 h-9 px-3"
              >
                Siguiente
                <HiOutlineChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tabla de campañas programadas / borrador */}
        {!loading && scheduledDraftCampaigns.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700">
                Campañas programadas / borrador
              </h2>
              <p className="text-xs text-slate-500">
                Campañas con estado <span className="font-medium">scheduled</span> o <span className="font-medium">pending</span>.
              </p>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3 font-medium text-violet-600 text-left">ID</th>
                  <th className="p-3 font-medium text-violet-600 text-left">Nombre</th>
                  <th className="p-3 font-medium text-violet-600 text-left">Sender</th>
                  <th className="p-3 font-medium text-violet-600 text-left">Asunto</th>
                  <th className="p-3 font-medium text-violet-600 text-left">Preheader</th>
                  <th className="p-3 font-medium text-violet-600 text-right">Recipients</th>
                  <th className="p-3 font-medium text-violet-600 text-left">Status</th>
                  <th className="p-3 font-medium text-violet-600 text-left">Scheduled at</th>
                  <th className="p-3 font-medium text-violet-600 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {scheduledDraftCampaigns.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-slate-600 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                    <td className="p-3 text-slate-800 font-medium">{c.name}</td>
                    <td className="p-3 text-slate-600">{c.sender_name}</td>
                    <td className="p-3 text-slate-600 max-w-[180px] truncate" title={c.subject ?? ""}>
                      {c.subject ?? "—"}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[160px] truncate" title={c.preheader ?? ""}>
                      {c.preheader ?? "—"}
                    </td>
                    <td className="p-3 text-slate-600 text-right">{c.num_recipients}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          c.status === "scheduled" && "bg-slate-100 text-slate-700",
                          c.status === "pending" && "bg-sky-100 text-sky-700",
                          !["scheduled", "pending"].includes(c.status) && "bg-slate-100 text-slate-600"
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {formatSentAt(c.scheduled_at)}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="default"
                          onClick={() => handleEditDraft(c.id)}
                          className="h-8 px-2 text-xs gap-1 border border-sky-200 text-sky-700 hover:bg-sky-50"
                        >
                          <FaEdit className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="default"
                          onClick={() => handleDeleteDraft(c.id)}
                          className="h-8 px-2 text-xs gap-1 border border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          <FaRegTrashAlt className="h-3 w-3" />
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  );
}
