import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Select, { type GroupBase, type MultiValue, type SingleValue } from "react-select";
import {
  HiOutlineArrowPath,
  HiOutlineCalendarDays,
  HiOutlineCheckBadge,
  HiOutlineCircleStack,
  HiOutlineSparkles,
  HiOutlineUsers,
} from "react-icons/hi2";
import { cn } from "../../lib/utils";
import { selectListStyles, type ListOption } from "../../components/ui/select-list";
import {
  fetchCampaigns,
  fetchSegmentacionById,
  fetchSegmentacionRecipients,
  refreshSegmentacion,
  updateSegmentacion,
  type CampaignListRow,
  type CreatorRead,
  type SegmentationCriteria,
  type SegmentationRead,
} from "../../lib/api";

const CRITERIA_OPTIONS: ListOption[] = [
  { value: "no_open", label: "Creadores que no abrieron el correo" },
  { value: "opened_no_click", label: "Abrieron el correo pero no hicieron clic" },
  { value: "opened_and_clicked", label: "Abrieron el correo e hicieron clic" },
];

function displayName(c: CreatorRead): string {
  if (c.full_name?.trim()) return c.full_name.trim();
  const n = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return n || c.email;
}

function criteriaLabel(value?: string): string {
  if (!value) return "Criterio sin definir";
  return CRITERIA_OPTIONS.find((x) => x.value === value)?.label ?? value;
}

export function SegmentacionDetallePage() {
  const { segmentationId } = useParams<{ segmentationId: string }>();
  const navigate = useNavigate();
  const [seg, setSeg] = useState<SegmentationRead | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [members, setMembers] = useState<CreatorRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("");
  const [criteria, setCriteria] = useState<ListOption | null>(CRITERIA_OPTIONS[0]);
  const [campaignSel, setCampaignSel] = useState<readonly ListOption[]>([]);
  const [search, setSearch] = useState("");

  const campaignOptions = useMemo<ListOption[]>(
    () => campaigns.map((c) => ({ value: c.id, label: `${c.name} · ${c.subject ?? "Sin asunto"}` })),
    [campaigns]
  );

  const loadAll = useCallback(async () => {
    if (!segmentationId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, c, m] = await Promise.all([
        fetchSegmentacionById(segmentationId),
        fetchCampaigns({}),
        fetchSegmentacionRecipients(segmentationId),
      ]);
      setSeg(s);
      setCampaigns(c);
      setMembers(m);
      setName(s.nombre);
      setCriteria(CRITERIA_OPTIONS.find((x) => x.value === s.criteria) ?? CRITERIA_OPTIONS[0]);
      const map = new Map(c.map((x) => [x.id, x]));
      setCampaignSel(
        s.campaign_ids.map((id) => ({
          value: id,
          label: `${map.get(id)?.name ?? id} · ${id.slice(0, 8)}`,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la segmentación.");
    } finally {
      setLoading(false);
    }
  }, [segmentationId]);

  useEffect(() => {
    if (!segmentationId) {
      navigate("/dashboard/segmentaciones", { replace: true });
      return;
    }
    void loadAll();
  }, [segmentationId, navigate, loadAll]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => {
      const n = displayName(m).toLowerCase();
      return (
        n.includes(t) ||
        m.email.toLowerCase().includes(t) ||
        m.id.toLowerCase().includes(t) ||
        (m.username || "").toLowerCase().includes(t)
      );
    });
  }, [members, search]);
  const createdAtLabel = useMemo(() => {
    if (!seg?.created_at) return "—";
    return new Date(seg.created_at).toLocaleString("es");
  }, [seg?.created_at]);

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentationId) return;
    const n = name.trim();
    if (!n) {
      void Swal.fire({ icon: "warning", title: "Nombre requerido", text: "Indica un nombre." });
      return;
    }
    if (campaignSel.length === 0) {
      void Swal.fire({ icon: "warning", title: "Campañas requeridas", text: "Selecciona campañas origen." });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSegmentacion(segmentationId, {
        nombre: n,
        campaign_ids: campaignSel.map((x) => x.value),
        criteria: (criteria?.value || "no_open") as SegmentationCriteria,
      });
      setSeg(updated);
      const rec = await fetchSegmentacionRecipients(segmentationId);
      setMembers(rec);
      void Swal.fire({ icon: "success", title: "Guardado", timer: 1200, showConfirmButton: false });
    } catch (e) {
      void Swal.fire({ icon: "error", title: "Error", text: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const doRefresh = async () => {
    if (!segmentationId) return;
    setRefreshing(true);
    try {
      const updated = await refreshSegmentacion(segmentationId);
      setSeg(updated);
      const rec = await fetchSegmentacionRecipients(segmentationId);
      setMembers(rec);
      void Swal.fire({
        icon: "success",
        title: "Segmentación recalculada",
        text: `Ahora contiene ${updated.num_creators} creador(es).`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (e) {
      void Swal.fire({ icon: "error", title: "Error", text: e instanceof Error ? e.message : "No se pudo recalcular." });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link to="/dashboard/segmentaciones" className="font-semibold text-purple hover:underline">
            Segmentación
          </Link>
          <span className="text-slate-400">/</span>
          <span className="font-medium text-slate-900">{seg?.nombre ?? "Detalle"}</span>
        </nav>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        {!error && (
          <>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-purple/12 via-transparent to-blue/10 blur-2xl"
                aria-hidden
              />
              <div className="relative flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple">
                      Segmentación Dinámica
                    </p>
                    <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {seg?.nombre || "Detalle de segmentación"}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                      Ajusta criterio, campañas base y recálculo de miembros para mantener esta audiencia
                      sincronizada con aperturas y clics más recientes.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <HiOutlineSparkles className="h-4 w-4" />
                    Segmentación viva
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Miembros actuales
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
                      <HiOutlineUsers className="h-5 w-5 text-purple" />
                      {seg?.num_creators ?? members.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Campañas base
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-slate-900">
                      <HiOutlineCircleStack className="h-5 w-5 text-indigo-600" />
                      {seg?.campaign_ids?.length ?? campaignSel.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Criterio activo
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <HiOutlineCheckBadge className="h-5 w-5 text-emerald-600" />
                      {criteriaLabel(seg?.criteria)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <form onSubmit={(e) => void saveMeta(e)} className="grid gap-4 lg:grid-cols-[1fr_280px_1fr_auto] lg:items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">Nombre</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">Criterio</span>
                  <Select<ListOption, false, GroupBase<ListOption>>
                    instanceId="seg-det-criteria"
                    inputId="seg-det-criteria-input"
                    styles={selectListStyles}
                    options={CRITERIA_OPTIONS}
                    value={criteria}
                    onChange={(v: SingleValue<ListOption>) => setCriteria(v ?? CRITERIA_OPTIONS[0])}
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    isSearchable={false}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">Campañas base</span>
                  <Select<ListOption, true, GroupBase<ListOption>>
                    instanceId="seg-det-campaigns"
                    inputId="seg-det-campaigns-input"
                    styles={selectListStyles as never}
                    options={campaignOptions}
                    value={campaignSel}
                    onChange={(v: MultiValue<ListOption>) => setCampaignSel(v)}
                    isMulti
                    closeMenuOnSelect={false}
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  />
                </label>
                <div className="flex gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => void doRefresh()}
                    disabled={refreshing}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <HiOutlineArrowPath className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      {refreshing ? "Recalculando…" : "Recalcular miembros"}
                    </span>
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple/90 disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <p>
                  Miembros actuales: <strong className="text-slate-700">{seg?.num_creators ?? members.length}</strong>
                </p>
                <p className="inline-flex items-center gap-1">
                  <HiOutlineCalendarDays className="h-4 w-4" />
                  Creada: <strong className="text-slate-700">{createdAtLabel}</strong>
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, email, username o ID…"
                  className={cn(
                    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800",
                    "focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/20"
                  )}
                />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {filtered.length} resultado(s)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">ID</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Username</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && filtered.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-10 text-slate-500">Cargando…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-14">
                          <div className="mx-auto flex max-w-md flex-col items-center text-center">
                            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <HiOutlineUsers className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">
                              No hay creadores para mostrar
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Revisa filtros o pulsa "Recalcular miembros" para sincronizar con nuevos eventos.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-3 font-mono text-xs text-slate-500">{m.id.slice(0, 13)}…</td>
                        <td className="px-3 py-3 text-slate-900 font-medium">{displayName(m)}</td>
                        <td className="px-3 py-3 text-slate-700">{m.email}</td>
                        <td className="px-3 py-3 text-slate-700">{m.username || "—"}</td>
                        <td className="px-3 py-3 text-slate-700">{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
