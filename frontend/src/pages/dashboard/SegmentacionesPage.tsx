import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select, { type GroupBase, type MultiValue, type SingleValue } from "react-select";
import type { StylesConfig } from "react-select";
import Swal from "sweetalert2";
import {
  createSegmentacion,
  deleteSegmentacion,
  downloadSegmentacionRecipients,
  fetchCampaigns,
  fetchSegmentaciones,
  updateSegmentacion,
  type CampaignListRow,
  type SegmentationCriteria,
  type SegmentationRead,
} from "../../lib/api";
import {
  HiOutlineArrowDownTray,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineFunnel,
  HiOutlineInformationCircle,
  HiOutlinePencilSquare,
  HiOutlinePlusCircle,
  HiOutlineTrash,
} from "react-icons/hi2";
import { cn } from "../../lib/utils";
import { selectListStyles, type ListOption } from "../../components/ui/select-list";

type CampaignOption = ListOption;

const CRITERIA_OPTIONS: ListOption[] = [
  { value: "no_open", label: "Creadores que no abrieron el correo" },
  { value: "opened_no_click", label: "Abrieron el correo pero no hicieron clic" },
  { value: "opened_and_clicked", label: "Abrieron el correo e hicieron clic" },
];

const campaignMultiStyles: StylesConfig<CampaignOption, true, GroupBase<CampaignOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: state.isFocused ? "rgb(167 139 250)" : "rgb(226 232 240)",
    backgroundColor: "#fff",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(139, 92, 246, 0.18)" : "none",
  }),
  valueContainer: (base) => ({ ...base, padding: "4px 10px", gap: 6, flexWrap: "wrap" }),
  menu: (base) => ({ ...base, borderRadius: 10, border: "1px solid rgb(226 232 240)", overflow: "hidden" }),
  option: (base, state) => ({
    ...base,
    cursor: "pointer",
    backgroundColor: state.isSelected ? "rgb(237 233 254)" : state.isFocused ? "rgb(245 243 255)" : "transparent",
    color: state.isSelected ? "rgb(76 29 149)" : "rgb(15 23 42)",
  }),
  multiValue: (base) => ({ ...base, borderRadius: 10, backgroundColor: "rgb(237 233 254)", border: "1px solid rgb(196 181 253)" }),
  multiValueLabel: (base) => ({ ...base, color: "rgb(67 56 202)", fontWeight: 600, fontSize: "0.8125rem" }),
  multiValueRemove: (base) => ({ ...base, color: "rgb(99 102 241)", ":hover": { backgroundColor: "rgb(221 214 254)", color: "rgb(79 70 229)" } }),
  indicatorSeparator: () => ({ display: "none" }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

function criteriaLabel(v: string): string {
  return CRITERIA_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function SegmentacionesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SegmentationRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignListRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSegmentation, setEditingSegmentation] = useState<SegmentationRead | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [draftCampaign, setDraftCampaign] = useState("");
  const [draftCreatedDate, setDraftCreatedDate] = useState("");
  const [draftCriteria, setDraftCriteria] = useState<ListOption | null>(null);
  const [appliedName, setAppliedName] = useState("");
  const [appliedCampaign, setAppliedCampaign] = useState("");
  const [appliedCreatedDate, setAppliedCreatedDate] = useState("");
  const [appliedCriteria, setAppliedCriteria] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [selectedCampaigns, setSelectedCampaigns] = useState<readonly CampaignOption[]>([]);
  const [criteria, setCriteria] = useState<ListOption | null>(CRITERIA_OPTIONS[0]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSegmentaciones();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las segmentaciones.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    void fetchCampaigns({})
      .then((camps) => {
        setCampaigns(camps);
        if (camps.length > 0 && selectedCampaigns.length === 0) {
          setSelectedCampaigns([{ value: camps[0].id, label: `${camps[0].name} · ${camps[0].subject ?? "Sin asunto"}` }]);
        }
      })
      .catch(() => {});
  }, []);

  const campaignOptions = useMemo<CampaignOption[]>(
    () =>
      campaigns.map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.subject ?? "Sin asunto"}`,
      })),
    [campaigns]
  );
  const campaignNameById = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns]
  );

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const nameOk = appliedName
        ? r.nombre.toLowerCase().includes(appliedName.toLowerCase())
        : true;
      const criteriaOk = appliedCriteria ? r.criteria === appliedCriteria : true;
      const campaignOk = appliedCampaign
        ? r.campaign_ids.some((id) => {
            const nm = campaignNameById.get(id) || "";
            return (
              id.toLowerCase().includes(appliedCampaign.toLowerCase()) ||
              nm.toLowerCase().includes(appliedCampaign.toLowerCase())
            );
          })
        : true;
      const createdOk = appliedCreatedDate
        ? new Date(r.created_at).toISOString().slice(0, 10) === appliedCreatedDate
        : true;
      return nameOk && criteriaOk && campaignOk && createdOk;
    });
  }, [rows, appliedName, appliedCriteria, appliedCampaign, appliedCreatedDate, campaignNameById]);

  const openCreateModal = () => {
    setEditingSegmentation(null);
    setName("");
    setSelectedCampaigns([]);
    setCriteria(CRITERIA_OPTIONS[0]);
    setModalOpen(true);
  };

  const openEditModal = (row: SegmentationRead) => {
    setEditingSegmentation(row);
    setName(row.nombre);
    setSelectedCampaigns(
      row.campaign_ids.map((id) => ({
        value: id,
        label: `${campaignNameById.get(id) ?? id} · ${id.slice(0, 8)}`,
      }))
    );
    setCriteria(CRITERIA_OPTIONS.find((x) => x.value === row.criteria) ?? CRITERIA_OPTIONS[0]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingSegmentation(null);
  };

  const applyFilters = () => {
    setAppliedName(draftName.trim());
    setAppliedCampaign(draftCampaign.trim());
    setAppliedCreatedDate(draftCreatedDate);
    setAppliedCriteria(draftCriteria?.value ?? null);
  };

  const clearFilters = () => {
    setDraftName("");
    setDraftCampaign("");
    setDraftCreatedDate("");
    setDraftCriteria(null);
    setAppliedName("");
    setAppliedCampaign("");
    setAppliedCreatedDate("");
    setAppliedCriteria(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      void Swal.fire({ icon: "warning", title: "Nombre requerido", text: "Indica un nombre para la segmentación." });
      return;
    }
    if (selectedCampaigns.length === 0) {
      void Swal.fire({ icon: "warning", title: "Campañas requeridas", text: "Selecciona al menos una campaña base." });
      return;
    }
    if (!criteria?.value) {
      void Swal.fire({ icon: "warning", title: "Criterio requerido", text: "Selecciona un criterio de segmentación." });
      return;
    }

    setSaving(true);
    try {
      if (editingSegmentation) {
        const updated = await updateSegmentacion(editingSegmentation.id, {
          nombre: n,
          campaign_ids: selectedCampaigns.map((x) => x.value),
          criteria: criteria.value as SegmentationCriteria,
        });
        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      } else {
        const created = await createSegmentacion({
          nombre: n,
          campaign_ids: selectedCampaigns.map((x) => x.value),
          criteria: criteria.value as SegmentationCriteria,
          status: "activo",
        });
        setRows((prev) => [created, ...prev]);
      }
      setName("");
      setSelectedCampaigns([]);
      setCriteria(CRITERIA_OPTIONS[0]);
      setModalOpen(false);
      await Swal.fire({
        icon: "success",
        title: editingSegmentation ? "Segmentación actualizada" : "Segmentación creada",
        confirmButtonColor: "#16a34a",
      });
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo crear la segmentación.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row: SegmentationRead) => {
    const r = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar segmentación?",
      html: `Se eliminará <strong>${row.nombre}</strong>. Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!r.isConfirmed) return;
    setRowBusyId(row.id);
    try {
      await deleteSegmentacion(row.id);
      setRows((prev) => prev.filter((x) => x.id !== row.id));
      void Swal.fire({ icon: "success", title: "Segmentación eliminada", timer: 1400, showConfirmButton: false });
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo eliminar.",
      });
    } finally {
      setRowBusyId(null);
    }
  };

  const onDownload = async (row: SegmentationRead) => {
    const r = await Swal.fire({
      icon: "question",
      title: "Descargar segmentación",
      text: "Selecciona formato de descarga:",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Excel (.xlsx)",
      denyButtonText: "CSV (.csv)",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#4f46e5",
      denyButtonColor: "#0ea5e9",
    });
    if (r.isDismissed) return;
    const format = r.isConfirmed ? "xlsx" : "csv";
    setRowBusyId(row.id);
    try {
      await downloadSegmentacionRecipients(row.id, format);
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Descarga",
        text: e instanceof Error ? e.message : "No se pudo descargar.",
      });
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/30">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-purple/12 via-transparent to-blue/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple">Audiencia</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Segmentación
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Crea grupos de seguimiento a partir del comportamiento real de campañas (aperturas y clics).
              Puedes usar una o varias campañas de origen y luego enviar campañas exclusivas para ese grupo.
            </p>
          </div>
          <div className="flex shrink-0 justify-end lg:max-w-md">
            <div className="flex w-full items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
              <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div className="space-y-1 text-sky-900/90">
                <p className="font-semibold text-sky-950">Guía rápida</p>
                <ul className="list-inside list-disc space-y-0.5 text-xs leading-relaxed text-sky-900/85">
                  <li>Usa <strong>recalcular</strong> en el detalle para reflejar nuevos opens/clicks.</li>
                  <li><strong>Descargar</strong> permite exportar miembros en CSV o Excel.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-t-2xl px-4 py-3.5 text-left sm:px-5",
            "transition-colors",
            filtersOpen ? "bg-gradient-to-r from-purple/[0.06] via-white to-blue/[0.06]" : "hover:bg-slate-50/80"
          )}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <HiOutlineFunnel className="h-5 w-5" />
            </span>
            Filtrar segmentaciones
          </span>
          {filtersOpen ? (
            <HiOutlineChevronDown className="h-5 w-5 text-slate-500" />
          ) : (
            <HiOutlineChevronRight className="h-5 w-5 text-slate-500" />
          )}
        </button>
        {filtersOpen && (
          <div className="border-t border-slate-100 px-4 pb-5 pt-3 sm:px-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Nombre segmentación</span>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900"
                  placeholder="Ej. Seguimiento Abril"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Campaña origen (nombre o ID)</span>
                <input
                  value={draftCampaign}
                  onChange={(e) => setDraftCampaign(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900"
                  placeholder="Nombre o UUID"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Criterio</span>
                <Select<ListOption, false, GroupBase<ListOption>>
                  instanceId="segmentaciones-filter-criteria"
                  inputId="segmentaciones-filter-criteria-input"
                  styles={selectListStyles}
                  options={CRITERIA_OPTIONS}
                  value={draftCriteria}
                  onChange={(v: SingleValue<ListOption>) => setDraftCriteria(v)}
                  isClearable
                  placeholder="Todos"
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Fecha de creación</span>
                <input
                  type="date"
                  value={draftCreatedDate}
                  onChange={(e) => setDraftCreatedDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple/90"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <span className="inline-flex items-center gap-2">
            <HiOutlinePlusCircle className="h-4 w-4" />
            Crear segmentación
          </span>
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Criterio</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Campañas base</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">N. creadores</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Creada</th>
              <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && filteredRows.length === 0 ? (
              <tr><td className="px-3 py-10 text-slate-500" colSpan={6}>Cargando…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td className="px-3 py-10 text-slate-500" colSpan={6}>No hay segmentaciones con esos filtros.</td></tr>
            ) : filteredRows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3 text-slate-900 font-medium">
                  <button
                    type="button"
                    className="hover:underline text-left"
                    onClick={() => navigate(`/dashboard/segmentaciones/${r.id}`)}
                  >
                    {r.nombre}
                  </button>
                </td>
                <td className="px-3 py-3 text-slate-700">{criteriaLabel(r.criteria)}</td>
                <td className="px-3 py-3">
                  {r.campaign_ids?.length ? (
                    <span
                      className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
                      title={r.campaign_ids
                        .map((id) => campaignNameById.get(id) || id)
                        .join("\n")}
                    >
                      {r.campaign_ids.length} campaña{r.campaign_ids.length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 tabular-nums text-emerald-700 font-semibold">{r.num_creators}</td>
                <td className="px-3 py-3 text-slate-500">{new Date(r.created_at).toLocaleString("es")}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-purple/30 hover:text-purple"
                      onClick={() => openEditModal(r)}
                      disabled={rowBusyId === r.id}
                    >
                      <HiOutlinePencilSquare className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800"
                      onClick={() => void onDownload(r)}
                      disabled={rowBusyId === r.id}
                    >
                      <HiOutlineArrowDownTray className="h-4 w-4" />
                      Descargar
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50/80 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                      onClick={() => void onDelete(r)}
                      disabled={rowBusyId === r.id}
                    >
                      <HiOutlineTrash className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={() => (saving ? null : setModalOpen(false))}
          />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/50" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">
              {editingSegmentation ? "Editar segmentación" : "Nueva segmentación"}
            </h2>
            <form onSubmit={(e) => void submit(e)} className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  placeholder="Ej. Seguimiento Launch ELVN - No Opened"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Campañas base *</label>
                <Select<CampaignOption, true, GroupBase<CampaignOption>>
                  instanceId="segmentacion-campaigns"
                  inputId="segmentacion-campaigns-input"
                  styles={campaignMultiStyles}
                  options={campaignOptions}
                  value={selectedCampaigns}
                  onChange={(opts: MultiValue<CampaignOption>) => setSelectedCampaigns(opts)}
                  isMulti
                  closeMenuOnSelect={false}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  menuPosition="fixed"
                  placeholder="Selecciona una o varias campañas"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Criterio *</label>
                <Select<ListOption, false, GroupBase<ListOption>>
                  instanceId="segmentacion-criteria"
                  inputId="segmentacion-criteria-input"
                  styles={selectListStyles}
                  options={CRITERIA_OPTIONS}
                  value={criteria}
                  onChange={(opt: SingleValue<ListOption>) => setCriteria(opt ?? CRITERIA_OPTIONS[0])}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  menuPosition="fixed"
                  isSearchable={false}
                />
              </div>
              <div className="lg:col-span-2 mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : editingSegmentation ? "Guardar cambios" : "Crear segmentación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
