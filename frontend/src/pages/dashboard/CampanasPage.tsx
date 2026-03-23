import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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

/** Tokens visuales (alineados al sidebar: claros + acentos de métrica) */
const DASH = {
  muted: "#64748b",
  text: "#0f172a",
  primary: "#6366f1",
  secondary: "#22c55e",
  danger: "#ef4444",
  accent: "#f59e0b",
} as const;

const SERIES_COLORS = [
  DASH.primary,
  "#0ea5e9",
  DASH.accent,
  "#8b5cf6",
  DASH.secondary,
  "#94a3b8",
];
const CHART_GRID = "rgba(148, 163, 184, 0.22)";
const CHART_AXIS = "#94a3b8";
const TOOLTIP_STYLE = {
  background: "rgba(255, 255, 255, 0.98)",
  border: "1px solid rgb(226 232 240)",
  borderRadius: 12,
  color: DASH.text,
  boxShadow: "0 14px 40px rgba(15, 23, 42, 0.1)",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Misma familia que las tarjetas del sidebar (blanco + borde slate suave) */
const cardSurface = cn(
  "rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm shadow-slate-200/70",
  "backdrop-blur-sm transition-shadow duration-300 hover:shadow-md hover:shadow-slate-300/45"
);

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "primary" | "secondary" | "accent" | "muted";
}) {
  const accent =
    tone === "primary"
      ? DASH.primary
      : tone === "secondary"
        ? DASH.secondary
        : tone === "accent"
          ? DASH.accent
          : "#94a3b8";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3 }}
      className={cn(
        cardSurface,
        "p-5 min-h-[108px] flex flex-col justify-between"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="text-2xl sm:text-3xl font-semibold tabular-nums text-slate-900 tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-slate-500 mt-1">{hint}</p> : null}
    </motion.div>
  );
}

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
    Promise.all([
      fetchCampaignOpens(selectedId),
      fetchCampaignClicks(selectedId),
      fetchCampaignClicksByRecipient(selectedId),
      fetchCampaignClicksByButton(selectedId),
      fetchBrevoCompare(selectedId).catch(() => null),
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

  const selectedCampaign = selectedId ? campaigns.find((c) => c.id === selectedId) : null;

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

  const tickMuted = { fill: DASH.muted, fontSize: 11 };
  const kpiRecipients =
    opensReport?.total_recipients ?? selectedCampaign?.num_recipients ?? null;
  const kpiUniqueOpens = opensReport?.unique_open_recipients ?? null;
  const kpiTotalOpenEvents = opensReport?.total_opens ?? null;
  const kpiOpenRateHint =
    kpiRecipients && kpiRecipients > 0 && kpiUniqueOpens != null
      ? `${((kpiUniqueOpens / kpiRecipients) * 100).toFixed(1)}% del envío abrió al menos una vez`
      : selectedCampaign
        ? `${selectedCampaign.open_rate_pct}% según listado de campañas`
        : undefined;
  const kpiClicksHint =
    selectedCampaign != null ? `CTR listado ${selectedCampaign.click_rate_pct}%` : undefined;

  const chartLegendStyle = { fontSize: 11, color: DASH.muted };

  return (
    <div className="min-h-full text-slate-800 bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 py-8 space-y-8">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-2"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Dashboard
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Campañas</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                {selectedCampaign ? (
                  <>
                    Analizando{" "}
                    <span className="font-medium text-indigo-600">{selectedCampaign.name}</span>
                    {" — "}
                    rendimiento por destinatario, dispositivo y geografía.
                  </>
                ) : (
                  <>
                    Selecciona una campaña en la tabla para ver KPIs y gráficos. Abajo, el listado
                    completo para profundizar.
                  </>
                )}
              </p>
            </div>
          </div>
        </motion.header>

        {/* KPIs: lectura rápida del estado de la campaña elegida */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {!selectedId ? (
            <>
              <KpiCard label="Destinatarios" value="—" hint="Elige una campaña" tone="muted" />
              <KpiCard label="Aperturas únicas" value="—" hint="Quién abrió al menos una vez" tone="muted" />
              <KpiCard label="Eventos de apertura" value="—" hint="Total de opens registrados" tone="muted" />
              <KpiCard label="Clics" value="—" hint="Interacción con enlaces" tone="muted" />
            </>
          ) : loadingDetail ? (
            <>
              <KpiCard label="Destinatarios" value="…" tone="primary" />
              <KpiCard label="Aperturas únicas" value="…" tone="secondary" />
              <KpiCard label="Eventos de apertura" value="…" tone="accent" />
              <KpiCard label="Clics" value="…" tone="muted" />
            </>
          ) : (
            <>
              <KpiCard
                label="Destinatarios"
                value={kpiRecipients != null ? String(kpiRecipients) : "—"}
                hint="Base del envío"
                tone="primary"
              />
              <KpiCard
                label="Aperturas únicas"
                value={kpiUniqueOpens != null ? String(kpiUniqueOpens) : "—"}
                hint={kpiOpenRateHint}
                tone="secondary"
              />
              <KpiCard
                label="Eventos de apertura"
                value={kpiTotalOpenEvents != null ? String(kpiTotalOpenEvents) : "—"}
                hint="Incluye re-aperturas (pixel)"
                tone="accent"
              />
              <KpiCard
                label="Clics"
                value={String(clicksTotal)}
                hint={kpiClicksHint}
                tone="muted"
              />
            </>
          )}
        </div>

        {/* Gráfico principal: historia por destinatario */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className={cn(cardSurface, "p-6")}
        >
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Rendimiento por destinatario</h2>
            </div>
          </div>
          {!selectedId ? (
            <div className="h-[340px] flex items-center justify-center text-slate-500 text-sm rounded-xl border border-dashed border-slate-200 bg-slate-50/90">
              Selecciona una campaña en la tabla inferior
            </div>
          ) : loadingDetail ? (
            <div className="h-[340px] flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
          ) : opensReport && clicksByRecipientReport && opensReport.recipients.length > 0 ? (
            <ResponsiveContainer width="100%" height={380}>
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
                margin={{ top: 12, right: 28, left: 4, bottom: 64 }}
              >
                <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={tickMuted}
                  stroke={CHART_AXIS}
                  angle={-32}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis tick={tickMuted} stroke={CHART_AXIS} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [
                    value,
                    name === "opens" ? "Aperturas" : "Clics",
                  ]}
                  labelFormatter={(label) => `Destinatario: ${label}`}
                />
                <Legend
                  wrapperStyle={chartLegendStyle}
                  formatter={(value) => (
                    <span style={{ color: DASH.muted }}>
                      {value === "opens" ? "Aperturas" : value === "clicks" ? "Clics" : value}
                    </span>
                  )}
                />
                <Bar
                  dataKey="clicks"
                  fill={DASH.secondary}
                  radius={[6, 6, 0, 0]}
                  name="clicks"
                />
                <Line
                  type="monotone"
                  dataKey="opens"
                  stroke={DASH.primary}
                  strokeWidth={2.5}
                  dot={{ fill: DASH.primary, r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name="opens"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[340px] flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
          )}
        </motion.section>

        {/* Secundarios: geografía ancha + columna (dispositivos + Brevo + botones) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={cn(cardSurface, "p-5 lg:col-span-7 min-h-[300px]")}
          >
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Aperturas por país</h3>
            <p className="text-[11px] text-slate-500 mb-4">Top países por eventos de pixel</p>
            {!selectedId ? (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                Selecciona una campaña
              </div>
            ) : loadingDetail ? (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
            ) : locationsReport && locationsReport.locations.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={locationsReport.locations.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, "auto"]}
                    tick={tickMuted}
                    stroke={CHART_AXIS}
                  />
                  <YAxis
                    type="category"
                    dataKey="country_code"
                    width={40}
                    tick={tickMuted}
                    stroke={CHART_AXIS}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div
                          className="rounded-xl px-3 py-2 text-xs text-slate-800"
                          style={{
                            background: TOOLTIP_STYLE.background,
                            border: TOOLTIP_STYLE.border,
                            boxShadow: TOOLTIP_STYLE.boxShadow,
                          }}
                        >
                          <span>
                            {(payload[0].payload as LocationCount).country_name ||
                              (payload[0].payload as LocationCount).country_code}
                          </span>
                          <span className="font-semibold ml-2" style={{ color: DASH.primary }}>
                            {payload[0].value}
                          </span>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#barGradGeo)"
                    radius={[0, 8, 8, 0]}
                    name="Aperturas"
                  />
                  <defs>
                    <linearGradient id="barGradGeo" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={DASH.primary} stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
            )}
          </motion.section>

          <div className="flex flex-col gap-4 lg:col-span-5">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className={cn(cardSurface, "p-5 flex-1 min-h-[280px]")}
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Dispositivos</h3>
              <p className="text-[11px] text-slate-500 mb-2">Distribución de aperturas / clics</p>
              {!selectedId ? (
                <div className="h-52 flex items-center justify-center text-slate-500 text-sm">
                  Selecciona una campaña
                </div>
              ) : loadingDetail ? (
                <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
              ) : devicesReport && devicesReport.devices.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={devicesReport.devices}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="#f1f5f9"
                      strokeWidth={2}
                    >
                      {devicesReport.devices.map((_, i) => (
                        <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend
                      wrapperStyle={chartLegendStyle}
                      formatter={(value) => (
                        <span style={{ color: DASH.muted }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14 }}
              className={cn(cardSurface, "p-5 min-h-[280px]")}
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Interno vs Brevo</h3>
              <p className="text-[11px] text-slate-500 mb-3">Aperturas y clics (últimos 31 días Brevo)</p>
              {!selectedId ? (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                  Selecciona una campaña
                </div>
              ) : loadingDetail ? (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
              ) : brevoCompare ? (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        {
                          name: "Aperturas",
                          Interno: brevoCompare.internal_unique_opens,
                          Brevo: brevoCompare.brevo_unique_opens,
                        },
                        {
                          name: "Clics",
                          Interno: brevoCompare.internal_total_clicks,
                          Brevo: brevoCompare.brevo_total_clicks,
                        },
                      ]}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="name" tick={tickMuted} stroke={CHART_AXIS} />
                      <YAxis tick={tickMuted} stroke={CHART_AXIS} domain={[0, "auto"]} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [`${value}`, name]} />
                      <Legend
                        wrapperStyle={chartLegendStyle}
                        formatter={(value) => (
                          <span style={{ color: DASH.muted }}>{value}</span>
                        )}
                      />
                      <Bar dataKey="Interno" fill={DASH.primary} radius={[6, 6, 0, 0]} name="Interno" />
                      <Bar dataKey="Brevo" fill="#38bdf8" radius={[6, 6, 0, 0]} name="Brevo" />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] leading-relaxed text-slate-500 border-t border-slate-100 pt-3">
                    Brevo: entregados {brevoCompare.brevo_delivered}, hard bounce{" "}
                    {brevoCompare.brevo_hard_bounces}, soft {brevoCompare.brevo_soft_bounces}, spam{" "}
                    {brevoCompare.brevo_spam_reports}.
                  </p>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
                  Brevo no disponible o sin datos
                </div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16 }}
              className={cn(cardSurface, "p-5 min-h-[260px]")}
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-1">Clics por botón</h3>
              <p className="text-[11px] text-slate-500 mb-3">Benchmarking de CTAs en plantilla</p>
              {!selectedId ? (
                <div className="h-44 flex items-center justify-center text-slate-500 text-sm">
                  Selecciona una campaña
                </div>
              ) : loadingDetail ? (
                <div className="h-44 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
              ) : clicksByButtonReport && clicksByButtonReport.buttons.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={clicksByButtonReport.buttons.map((b) => ({
                      name: b.button_id.length > 14 ? `${b.button_id.slice(0, 12)}…` : b.button_id,
                      clicks: b.clicks,
                    }))}
                    margin={{ top: 8, right: 12, left: 0, bottom: 28 }}
                  >
                    <CartesianGrid strokeDasharray="4 8" stroke={CHART_GRID} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={tickMuted}
                      stroke={CHART_AXIS}
                      angle={-30}
                      textAnchor="end"
                      height={48}
                      interval={0}
                    />
                    <YAxis
                      tick={tickMuted}
                      stroke={CHART_AXIS}
                      label={{
                        value: "Clics",
                        angle: -90,
                        position: "insideLeft",
                        fill: DASH.muted,
                        fontSize: 10,
                      }}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number) => [value, "Clics"]}
                      labelFormatter={(label) => `Botón: ${label}`}
                    />
                    <Bar dataKey="clicks" fill={DASH.accent} radius={[6, 6, 0, 0]} name="Clics" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-slate-500 text-sm">
                  Sin clics por botón
                </div>
              )}
            </motion.section>
          </div>
        </div>

        <div className="space-y-6 border-t border-slate-200/90 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Campañas — listado y filtros
          </p>

      {/* Row 2: Accordion filtros + botones */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200",
              filtersOpen
                ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
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
              className="gap-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50/90"
            >
              <HiOutlinePlus className="h-4 w-4" />
              Nueva campaña
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="default"
            className="gap-2 rounded-xl border border-sky-200 bg-white text-sky-700 hover:bg-sky-50/90"
            onClick={handleExportExcel}
            disabled={exporting}
          >
            <HiOutlineArrowDownTray className="h-4 w-4" />
            {exporting ? "Descargando…" : "Descargar Excel"}
          </Button>
        </div>

        {filtersOpen && (
          <div className={cn(cardSurface, "p-5")}>
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
                className="rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                Limpiar filtros
              </Button>
              <Button
                size="default"
                onClick={loadCampaigns}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-md shadow-slate-300/40"
              >
                Aplicar filtros
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Row 3: Tabla */}
      <div className={cn(cardSurface, "overflow-hidden")}>
        {error && (
          <div className="p-4 text-rose-600 text-sm border-b border-slate-100">{error}</div>
        )}
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando campañas…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left">
                  <th className="p-3 font-medium text-violet-700">ID</th>
                  <th className="p-3 font-medium text-violet-700">Nombre</th>
                  <th className="p-3 font-medium text-violet-700">Sender</th>
                  <th className="p-3 font-medium text-violet-700">Asunto</th>
                  <th className="p-3 font-medium text-violet-700">Preheader</th>
                  <th className="p-3 font-medium text-violet-700">Recipients</th>
                  <th className="p-3 font-medium text-violet-700">Status</th>
                  <th className="p-3 font-medium text-violet-700">Sent at</th>
                  <th className="p-3 font-medium text-violet-700">Aperturas</th>
                  <th className="p-3 font-medium text-violet-700">Clics</th>
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
                        "border-b border-slate-100 transition-colors",
                        isClickable && "hover:bg-slate-50 cursor-pointer",
                        !isClickable && "cursor-default opacity-75",
                        selectedId === c.id && "bg-indigo-50 border-l-[3px] border-l-indigo-500"
                      )}
                    >
                      <td className="p-3 text-slate-500 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                      <td className="p-3 text-slate-900 font-medium">{c.name}</td>
                      <td className="p-3 text-slate-600">{c.sender_name}</td>
                      <td className="p-3 text-slate-600 max-w-[120px] truncate" title={c.subject ?? ""}>
                        {c.subject ?? "—"}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[100px] truncate" title={c.preheader ?? ""}>
                        {c.preheader ?? "—"}
                      </td>
                      <td className="p-3 text-slate-600 tabular-nums">{c.num_recipients}</td>
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
                      <td className="p-3 text-slate-700 tabular-nums">
                        {c.total_opens} <span className="text-slate-500">({c.open_rate_pct}%)</span>
                      </td>
                      <td className="p-3 text-slate-700 tabular-nums">
                        {c.total_clicks} <span className="text-slate-500">({c.click_rate_pct}%)</span>
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
                className="gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 h-9 px-3"
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
                className="gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 h-9 px-3"
              >
                Siguiente
                <HiOutlineChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

        {/* Tabla de campañas programadas / borrador */}
        {!loading && scheduledDraftCampaigns.length > 0 && (
          <div className={cn(cardSurface, "mt-8 overflow-hidden")}>
            <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Campañas programadas / borrador
              </h2>
              <p className="text-xs text-slate-500">
                Campañas con estado <span className="font-medium text-slate-600">scheduled</span> o{" "}
                <span className="font-medium text-slate-600">pending</span>.
              </p>
            </div>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/90">
                <tr>
                  <th className="p-3 font-medium text-violet-700 text-left">ID</th>
                  <th className="p-3 font-medium text-violet-700 text-left">Nombre</th>
                  <th className="p-3 font-medium text-violet-700 text-left">Sender</th>
                  <th className="p-3 font-medium text-violet-700 text-left">Asunto</th>
                  <th className="p-3 font-medium text-violet-700 text-left">Preheader</th>
                  <th className="p-3 font-medium text-violet-700 text-right">Recipients</th>
                  <th className="p-3 font-medium text-violet-700 text-left">Status</th>
                  <th className="p-3 font-medium text-violet-700 text-left">Scheduled at</th>
                  <th className="p-3 font-medium text-violet-700 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {scheduledDraftCampaigns.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-slate-500 font-mono text-xs">{c.id.slice(0, 8)}…</td>
                    <td className="p-3 text-slate-900 font-medium">{c.name}</td>
                    <td className="p-3 text-slate-600">{c.sender_name}</td>
                    <td className="p-3 text-slate-600 max-w-[180px] truncate" title={c.subject ?? ""}>
                      {c.subject ?? "—"}
                    </td>
                    <td className="p-3 text-slate-600 max-w-[160px] truncate" title={c.preheader ?? ""}>
                      {c.preheader ?? "—"}
                    </td>
                    <td className="p-3 text-slate-600 text-right tabular-nums">{c.num_recipients}</td>
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
                          className="h-8 px-2 text-xs gap-1 rounded-lg border border-sky-200 text-sky-700 hover:bg-sky-50"
                        >
                          <FaEdit className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="default"
                          onClick={() => handleDeleteDraft(c.id)}
                          className="h-8 px-2 text-xs gap-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"
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
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
      />
    </div>
  );
}
