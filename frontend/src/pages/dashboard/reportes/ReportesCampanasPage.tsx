import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCampaigns,
  fetchCampaignLocations,
  fetchCampaignDevices,
  fetchCampaignClicksByButton,
  fetchTemplates,
  fetchSenders,
  type CampaignListRow,
  type CampaignFilters,
  type LocationCount,
  type DeviceCount,
  type ButtonClicks,
  type TemplateRead,
  type SenderRead,
} from "../../../lib/api";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import {
  HiOutlineChevronDown,
  HiOutlineChevronRight,
} from "react-icons/hi2";
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
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { ChoroplethMap } from "../../../components/reportes/ChoroplethMap";

const CHART_GRID = "rgba(148, 163, 184, 0.25)";
const TOOLTIP_BG = "rgba(255, 255, 255, 0.98)";
const COLORS = ["#6366f1", "#0ea5e9", "#ec4899", "#64748b", "#10b981", "#f59e0b"];

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

function hasAnyFilter(f: CampaignFilters, selectedCampaignIds: string[]): boolean {
  const hasFilterValues = Object.values(f).some((v) => v != null && v !== "");
  return hasFilterValues || selectedCampaignIds.length > 0;
}

export function ReportesCampanasPage() {
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState<CampaignFilters>({});
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [templates, setTemplates] = useState<TemplateRead[]>([]);
  const [senders, setSenders] = useState<SenderRead[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<CampaignListRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aggregatedLocations, setAggregatedLocations] = useState<LocationCount[]>([]);
  const [aggregatedDevices, setAggregatedDevices] = useState<DeviceCount[]>([]);
  const [aggregatedLinks, setAggregatedLinks] = useState<ButtonClicks[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    Promise.all([fetchTemplates(), fetchSenders(), fetchCampaigns({})]).then(
      ([tpls, snds, allCampaigns]) => {
        setTemplates(tpls);
        setSenders(snds);
        const runningOrSent = allCampaigns.filter((c) => c.status === "running" || c.status === "sent");
        setCampaignOptions(runningOrSent);
      }
    ).catch(() => {});
  }, []);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requestFilters = { ...filters };
      if (selectedCampaignIds.length > 0) {
        delete requestFilters.campaign_id;
        delete requestFilters.campaign_name;
      }
      const data = await fetchCampaigns(requestFilters);
      let withDefault =
        !hasAnyFilter(filters, selectedCampaignIds)
          ? data.filter((c) => c.status === "running" || c.status === "sent")
          : data;
      if (selectedCampaignIds.length > 0) {
        withDefault = withDefault.filter((c) => selectedCampaignIds.includes(c.id));
      }
      setCampaigns(withDefault);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar campañas");
    } finally {
      setLoading(false);
    }
  }, [filters, selectedCampaignIds]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Cargar ubicaciones, dispositivos y clics por enlace agregados
  useEffect(() => {
    if (campaigns.length === 0) {
      setAggregatedLocations([]);
      setAggregatedDevices([]);
      setAggregatedLinks([]);
      return;
    }
    setLoadingReport(true);
    const ids = campaigns.map((c) => c.id);
    Promise.all([
      Promise.all(ids.map((id) => fetchCampaignLocations(id).catch(() => ({ campaign_id: id, locations: [] as LocationCount[] })))),
      Promise.all(ids.map((id) => fetchCampaignDevices(id).catch(() => ({ campaign_id: id, devices: [] as DeviceCount[] })))),
      Promise.all(ids.map((id) => fetchCampaignClicksByButton(id).catch(() => ({ campaign_id: id, buttons: [] as ButtonClicks[] })))),
    ])
      .then(([locResults, devResults, linkResults]) => {
        const byCountry = new Map<string, { country_code: string; country_name: string; count: number }>();
        for (const r of locResults) {
          for (const loc of r.locations) {
            const key = (loc.country_code || "").toLowerCase();
            const cur = byCountry.get(key);
            if (!cur) {
              byCountry.set(key, { country_code: loc.country_code, country_name: loc.country_name, count: loc.count });
            } else {
              cur.count += loc.count;
            }
          }
        }
        setAggregatedLocations(Array.from(byCountry.values()).sort((a, b) => b.count - a.count));

        const byDevice = new Map<string, number>();
        for (const r of devResults) {
          for (const d of r.devices) {
            byDevice.set(d.device, (byDevice.get(d.device) ?? 0) + d.count);
          }
        }
        setAggregatedDevices(
          Array.from(byDevice.entries()).map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count)
        );

        const byLink = new Map<string, number>();
        for (const r of linkResults) {
          for (const b of r.buttons) {
            const label = b.button_id || "(sin id)";
            byLink.set(label, (byLink.get(label) ?? 0) + b.clicks);
          }
        }
        setAggregatedLinks(
          Array.from(byLink.entries())
            .map(([button_id, clicks]) => ({ button_id, clicks }))
            .sort((a, b) => b.clicks - a.clicks)
        );
      })
      .finally(() => setLoadingReport(false));
  }, [campaigns]);

  const kpis = useMemo(() => {
    const n = campaigns.length;
    const totalRecipients = campaigns.reduce((s, c) => s + c.num_recipients, 0);
    const totalOpens = campaigns.reduce((s, c) => s + c.total_opens, 0);
    const totalClicks = campaigns.reduce((s, c) => s + c.total_clicks, 0);
    // Tasas sobre enviados (siempre ≤ 100%), evita CTR clics/aperturas que puede exagerarse
    const overallOpenRate =
      totalRecipients > 0 ? Number(((totalOpens / totalRecipients) * 100).toFixed(1)) : 0;
    const overallClickRate =
      totalRecipients > 0 ? Number(((totalClicks / totalRecipients) * 100).toFixed(1)) : 0;
    return {
      campaigns: n,
      totalRecipients,
      totalOpens,
      totalClicks,
      overallOpenRate,
      overallClickRate,
    };
  }, [campaigns]);

  const barChartData = useMemo(
    () =>
      campaigns
        .slice(0, 12)
        .map((c) => ({
          name: c.name.length > 18 ? `${c.name.slice(0, 16)}…` : c.name,
          aperturas: c.total_opens,
          clics: c.total_clicks,
        })),
    [campaigns]
  );

  const setQuickRange = useCallback((days: number) => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - days);
    setFilters((f) => ({
      ...f,
      scheduled_at_from: from.toISOString().slice(0, 10),
      scheduled_at_to: to.toISOString().slice(0, 10),
    }));
  }, []);

  const funnelData = useMemo(() => {
    const sent = kpis.totalRecipients;
    const opens = kpis.totalOpens;
    const clicks = kpis.totalClicks;
    return [
      { etapa: "Enviados", valor: sent, fill: "#6366f1" },
      { etapa: "Abiertos", valor: opens, fill: "#0ea5e9" },
      { etapa: "Clics", valor: clicks, fill: "#10b981" },
    ];
  }, [kpis.totalRecipients, kpis.totalOpens, kpis.totalClicks]);

  const timeSeriesData = useMemo(() => {
    const byDate = new Map<string, { aperturas: number; clics: number }>();
    for (const c of campaigns) {
      const d = c.sent_at ? c.sent_at.slice(0, 10) : c.created_at.slice(0, 10);
      const cur = byDate.get(d) ?? { aperturas: 0, clics: 0 };
      cur.aperturas += c.total_opens;
      cur.clics += c.total_clicks;
      byDate.set(d, cur);
    }
    return Array.from(byDate.entries())
      .map(([fecha, v]) => ({ fecha, ...v }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-30);
  }, [campaigns]);

  // Tasa de clics sobre enviados (0-100%), no clics/aperturas que puede >100%
  const clickRateByCampaign = useMemo(
    () =>
      campaigns
        .filter((c) => c.num_recipients > 0)
        .map((c) => ({
          name: c.name.length > 16 ? `${c.name.slice(0, 14)}…` : c.name,
          tasaClics: Math.min(100, Number(((c.total_clicks / c.num_recipients) * 100).toFixed(1))),
        }))
        .sort((a, b) => b.tasaClics - a.tasaClics)
        .slice(0, 10),
    [campaigns]
  );

  const byTemplate = useMemo(() => {
    const m = new Map<string, { opens: number; clicks: number; recipients: number }>();
    for (const c of campaigns) {
      const key = c.template_name || "(sin plantilla)";
      const cur = m.get(key) ?? { opens: 0, clicks: 0, recipients: 0 };
      cur.opens += c.total_opens;
      cur.clicks += c.total_clicks;
      cur.recipients += c.num_recipients;
      m.set(key, cur);
    }
    return Array.from(m.entries()).map(([template, v]) => ({
      template,
      openRate: v.recipients > 0 ? Number(((v.opens / v.recipients) * 100).toFixed(1)) : 0,
      clickRate: v.recipients > 0 ? Math.min(100, Number(((v.clicks / v.recipients) * 100).toFixed(1))) : 0,
    }));
  }, [campaigns]);

  const bySubject = useMemo(() => {
    const m = new Map<string, { opens: number; recipients: number }>();
    for (const c of campaigns) {
      const key = (c.subject || "(sin asunto)").slice(0, 255);
      const cur = m.get(key) ?? { opens: 0, recipients: 0 };
      cur.opens += c.total_opens;
      cur.recipients += c.num_recipients;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([subject, v]) => ({
        subject,
        openRate: v.recipients > 0 ? Number(((v.opens / v.recipients) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.openRate - a.openRate)
      .slice(0, 8);
  }, [campaigns]);

  const insights = useMemo(() => {
    const lines: string[] = [];
    if (campaigns.length === 0) return lines;
    lines.push(`La tasa de apertura sobre enviados fue ${kpis.overallOpenRate}% y la de clics ${kpis.overallClickRate}%.`);
    const best = [...campaigns].sort((a, b) => b.total_opens - a.total_opens)[0];
    if (best) lines.push(`La campaña con más aperturas fue "${best.name.length > 35 ? best.name.slice(0, 33) + "…" : best.name}".`);
    if (aggregatedDevices.length > 0) {
      const topDevice = aggregatedDevices[0];
      lines.push(`El dispositivo más usado fue ${topDevice.device} (${topDevice.count} aperturas).`);
    }
    if (aggregatedLocations.length > 0) {
      const topCountry = aggregatedLocations[0];
      lines.push(`El país con más aperturas fue ${topCountry.country_name || topCountry.country_code}.`);
    }
    return lines;
  }, [campaigns, kpis.overallOpenRate, kpis.overallClickRate, aggregatedDevices, aggregatedLocations]);

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20 space-y-6">
      <nav className="text-sm text-slate-600 mb-2">
        <Link to="/dashboard/reportes" className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
          Reportes
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-medium">Campañas</span>
      </nav>
      <h1 className="text-2xl font-bold text-slate-800">
        <span className="text-violet-600">Reporte</span> de campañas
      </h1>

      {/* Quick filters + Filtros */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rango rápido:</span>
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              type="button"
              variant="ghost"
              size="default"
              className="text-sm py-1.5 h-auto text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200"
              onClick={() => setQuickRange(d)}
            >
              Últimos {d} días
            </Button>
          ))}
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
            {filtersOpen ? <HiOutlineChevronDown className="h-4 w-4" /> : <HiOutlineChevronRight className="h-4 w-4" />}
            Filtros de campañas
          </button>
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
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Sender</label>
                <select
                  value={filters.sender_id ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, sender_id: e.target.value || undefined, sender_name: undefined }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todas</option>
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
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
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Plantilla</label>
                <select
                  value={filters.template_id ?? ""}
                  onChange={(e) => setFilters((f) => ({ ...f, template_id: e.target.value || undefined, template_name: undefined }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todas</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name ?? t.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Campaña (varias)</label>
                <select
                  multiple
                  value={selectedCampaignIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                    setSelectedCampaignIds(selected);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                >
                  {campaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">Ctrl+clic para varias</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="default"
                onClick={() => {
                  setFilters({});
                  setSelectedCampaignIds([]);
                }}
                className="text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-slate-200 bg-white"
              >
                Limpiar filtros
              </Button>
              <Button size="default" onClick={loadCampaigns} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Dashboard */}
      <div className="space-y-6">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Cargando campañas…
          </div>
        ) : (
          <>
            {/* Insights del periodo */}
            {insights.length > 0 && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm">
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-2">📈 Insights del periodo</p>
                <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                  {insights.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* KPIs: Enviados | Aperturas | Clics | Tasa apertura | Tasa clics (todas sobre enviados) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Enviados</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{kpis.totalRecipients.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Aperturas</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1">{kpis.totalOpens.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider">Clics</p>
                <p className="text-2xl font-bold text-sky-600 mt-1">{kpis.totalClicks.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tasa apertura</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{kpis.overallOpenRate}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tasa clics</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{kpis.overallClickRate}%</p>
              </div>
            </div>

            {/* Funnel (barras) + Evolución por fecha en la misma fila */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-1">Funnel de email</p>
                <p className="text-xs text-slate-500 mb-3">Los clics pueden superar a las aperturas (varios clics por persona).</p>
                <div className="flex flex-col gap-3 max-w-2xl">
                  {funnelData.map(({ etapa, valor, fill }) => {
                    const pct = kpis.totalRecipients > 0 ? (valor / kpis.totalRecipients) * 100 : 0;
                    return (
                      <div key={etapa} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-600 w-20 shrink-0">{etapa}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden min-w-[80px]">
                          <div
                            className="h-full rounded-md transition-all duration-500"
                            style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: fill }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-800 w-14 text-right shrink-0">{valor.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {timeSeriesData.length > 0 && (
                <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-indigo-600 uppercase tracking-wider mb-2">Aperturas y clics por fecha</p>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{ top: 4, right: 8, left: 0, bottom: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="fecha" tick={{ fill: "#475569", fontSize: 9 }} stroke="#64748b" />
                        <YAxis tick={{ fill: "#475569", fontSize: 9 }} stroke="#64748b" domain={[0, "auto"]} width={28} />
                        <Tooltip
                          contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }}
                          formatter={(v: number, name: string) => [v, name === "aperturas" ? "Aperturas" : "Clics"]}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => (v === "aperturas" ? "Aperturas" : "Clics")} />
                        <Line type="monotone" dataKey="aperturas" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} name="aperturas" />
                        <Line type="monotone" dataKey="clics" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} name="clics" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Top campañas por tasa de clics | Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-2">Top campañas por tasa de clics (sobre enviados)</p>
                {clickRateByCampaign.length > 0 ? (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={clickRateByCampaign} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#475569", fontSize: 10 }} stroke="#64748b" unit="%" />
                        <YAxis type="category" dataKey="name" width={88} tick={{ fill: "#475569", fontSize: 9 }} stroke="#64748b" />
                        <Tooltip
                          contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8 }}
                          formatter={(v: number) => [`${v}%`, "Tasa clics"]}
                        />
                        <Bar dataKey="tasaClics" fill="#10b981" radius={[0, 4, 4, 0]} name="Tasa clics" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Sin datos</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden min-w-0">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-2">Ranking de campañas</p>
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-1.5 px-1.5 font-medium text-slate-600 text-xs">Campaña</th>
                        <th className="text-right py-1.5 px-1.5 font-medium text-slate-600 text-xs">Opens</th>
                        <th className="text-right py-1.5 px-1.5 font-medium text-slate-600 text-xs">Clics</th>
                        <th className="text-right py-1.5 px-1.5 font-medium text-slate-600 text-xs">T. apertura</th>
                        <th className="text-right py-1.5 px-1.5 font-medium text-slate-600 text-xs">T. clics</th>
                        <th className="text-right py-1.5 px-1.5 font-medium text-slate-600 text-xs">Enviado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.slice(0, 12).map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1.5 px-1.5 text-slate-800 truncate max-w-[120px]" title={c.name}>{c.name}</td>
                          <td className="py-1.5 px-1.5 text-right text-slate-600">{c.total_opens.toLocaleString()}</td>
                          <td className="py-1.5 px-1.5 text-right text-slate-600">{c.total_clicks.toLocaleString()}</td>
                          <td className="py-1.5 px-1.5 text-right text-slate-600">{c.open_rate_pct.toFixed(1)}%</td>
                          <td className="py-1.5 px-1.5 text-right text-slate-600">{c.click_rate_pct.toFixed(1)}%</td>
                          <td className="py-1.5 px-1.5 text-right text-slate-500 text-xs">
                            {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Dispositivos (30%) + Mapa (70%) */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_7fr] gap-6 items-stretch">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-3">Dispositivos (agregado)</p>
                {loadingReport ? (
                  <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Cargando…</div>
                ) : aggregatedDevices.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={aggregatedDevices}
                        dataKey="count"
                        nameKey="device"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="rgba(15,23,42,0.6)"
                      >
                        {aggregatedDevices.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" }}
                        formatter={(value: number, name: string) => [value, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-slate-600">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Sin datos de dispositivos</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-2">Mapa de calor geográfico — Aperturas por país</p>
                {loadingReport ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm h-[320px] flex items-center justify-center text-slate-500 text-sm">Cargando ubicaciones…</div>
                ) : (
                  <ChoroplethMap locations={aggregatedLocations} height={320} />
                )}
              </div>
            </div>

            {/* Top enlaces clickeados */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-3">Top enlaces clickeados (CTA)</p>
              {aggregatedLinks.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.min(320, aggregatedLinks.length * 36 + 40)}>
                  <BarChart
                    data={aggregatedLinks.slice(0, 10).map((b) => ({ name: b.button_id.length > 28 ? `${b.button_id.slice(0, 26)}…` : b.button_id, clics: b.clicks }))}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#475569", fontSize: 10 }} stroke="#64748b" />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#475569", fontSize: 10 }} stroke="#64748b" />
                    <Tooltip contentStyle={{ background: TOOLTIP_BG, border: "1px solid #e2e8f0", borderRadius: 8 }} formatter={(v: number) => [v, "Clics"]} />
                    <Bar dataKey="clics" fill="#ec4899" radius={[0, 4, 4, 0]} name="Clics" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-24 flex items-center justify-center text-slate-500 text-sm">Sin datos de clics por enlace</div>
              )}
            </div>

            {/* Rendimiento por plantilla + Top asuntos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-3">Rendimiento por plantilla</p>
                {byTemplate.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {byTemplate.map((t) => (
                      <div key={t.template} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                        <span className="text-slate-800 truncate max-w-[180px]" title={t.template}>{t.template}</span>
                        <span className="text-slate-600 shrink-0 ml-2">Apertura {t.openRate}% · Clics {t.clickRate}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-slate-500 text-sm">Sin datos por plantilla</div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-sky-600 uppercase tracking-wider mb-3">Top asuntos por tasa de apertura</p>
                {bySubject.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {bySubject.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 gap-2">
                        <span className="text-slate-800 whitespace-normal break-words">{s.subject}</span>
                        <span className="text-indigo-600 font-medium shrink-0 ml-2">{s.openRate}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center text-slate-500 text-sm">Sin datos por asunto</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
