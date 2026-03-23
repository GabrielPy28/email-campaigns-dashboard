import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Select, { type GroupBase, type SingleValue } from "react-select";
import Swal from "sweetalert2";
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
import {
  createLista,
  deleteLista,
  downloadListaRecipientsExcel,
  fetchListas,
  updateLista,
  type ListaListFilters,
  type ListaRead,
} from "../../lib/api";
import { selectListStyles, type ListOption } from "../../components/ui/select-list";

const LISTA_STATUS_FILTER: ListOption[] = [
  { value: "activo", label: "Activa" },
  { value: "inactivo", label: "Inactiva" },
];

function listaStatusLabel(status: string): string {
  return status === "inactivo" ? "Inactiva" : "Activa";
}

export function ListasPage() {
  const [listas, setListas] = useState<ListaRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<ListOption | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<ListaListFilters>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formStatus, setFormStatus] = useState<ListOption | null>(LISTA_STATUS_FILTER[0]);
  const [saving, setSaving] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchListas(appliedFilters);
      setListas(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar las listas.");
      setListas([]);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    const next: ListaListFilters = {};
    const s = draftSearch.trim();
    if (s) next.search = s;
    if (draftStatus?.value) next.status = draftStatus.value;
    setAppliedFilters(next);
  };

  const clearFilters = () => {
    setDraftSearch("");
    setDraftStatus(null);
    setAppliedFilters({});
  };

  const openCreate = () => {
    setFormNombre("");
    setFormStatus(LISTA_STATUS_FILTER[0]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = formNombre.trim();
    if (!nombre) {
      void Swal.fire({ icon: "warning", title: "Nombre requerido", text: "Indica un nombre para la lista." });
      return;
    }
    const st = (formStatus?.value ?? "activo") as "activo" | "inactivo";
    setSaving(true);
    try {
      await createLista({ nombre, status: st });
      void Swal.fire({ icon: "success", title: "Lista creada", timer: 1800, showConfirmButton: false });
      setModalOpen(false);
      await load();
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo guardar.",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDownload = async (l: ListaRead) => {
    setRowBusyId(l.id);
    try {
      await downloadListaRecipientsExcel(l.id);
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Descarga",
        text: err instanceof Error ? err.message : "No se pudo generar el Excel.",
      });
    } finally {
      setRowBusyId(null);
    }
  };

  const onDelete = async (l: ListaRead) => {
    const r = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar lista?",
      html: `Se eliminará <strong>${l.nombre}</strong>. Los creadores no se borran; solo se quita la asociación a esta lista.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#7c3aed",
    });
    if (!r.isConfirmed) return;
    setRowBusyId(l.id);
    try {
      await deleteLista(l.id);
      void Swal.fire({ icon: "success", title: "Lista eliminada", timer: 1600, showConfirmButton: false });
      await load();
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo eliminar.",
      });
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.35)_45%,transparent_100%)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Cabecera */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-purple/12 via-transparent to-blue/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple">
                Audiencia
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Listas
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Agrupa creadores registrados para usarlos como audiencia al crear campañas. Cada lista
                es un contenedor reutilizable: puedes añadir o quitar miembros desde la página de
                Creadores o importando archivos. Filtra por nombre, ID o estado para localizar una
                lista rápidamente.
              </p>
            </div>
            <div className="flex shrink-0 justify-end lg:max-w-md">
              <div className="flex w-full items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <div className="space-y-1 text-sky-900/90">
                  <p className="font-semibold text-sky-950">Guía rápida</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs leading-relaxed text-sky-900/85">
                    <li>
                      <strong>Descargar Excel</strong> exporta los creadores vinculados a esa lista.
                    </li>
                    <li>
                      Listas <strong>inactivas</strong> siguen existiendo; úsalas para archivar
                      segmentaciones que ya no uses en campañas nuevas.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-t-2xl px-4 py-3.5 text-left sm:px-5",
              "transition-colors",
              filtersOpen
                ? "bg-gradient-to-r from-purple/[0.06] via-white to-blue/[0.06]"
                : "hover:bg-slate-50/80"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <HiOutlineFunnel className="h-5 w-5" />
              </span>
              Filtrar listas
            </span>
            {filtersOpen ? (
              <HiOutlineChevronDown className="h-5 w-5 text-slate-500" />
            ) : (
              <HiOutlineChevronRight className="h-5 w-5 text-slate-500" />
            )}
          </button>
          {filtersOpen && (
            <div className="border-t border-slate-100 px-4 pb-5 pt-3 sm:px-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:items-end">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-600">
                    Nombre o ID (contiene)
                  </span>
                  <input
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="Ej. Belleza o fragmento de UUID…"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900 placeholder:text-slate-400 focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/15"
                    autoComplete="off"
                  />
                </label>
                <div className="w-full min-w-[180px] max-w-[320px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">Status</span>
                    <Select<ListOption, false, GroupBase<ListOption>>
                      instanceId="listas-filter-status"
                      inputId="listas-filter-status-input"
                      classNamePrefix="react-select-listas-status"
                      styles={selectListStyles}
                      isClearable
                      placeholder="Todas"
                      options={LISTA_STATUS_FILTER}
                      value={draftStatus}
                      onChange={(opt: SingleValue<ListOption>) => setDraftStatus(opt)}
                      menuPosition="fixed"
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
            </div>
          )}
        </div>

        {/* Acción principal: entre filtros y tabla */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={openCreate}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border border-purple/25 bg-gradient-to-r from-purple to-purple/90 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple/25",
              "hover:border-purple/40 hover:shadow-lg hover:shadow-purple/20"
            )}
          >
            <HiOutlinePlusCircle className="h-5 w-5" />
            Crear lista
          </button>
        </div>

        {loadError && (
          <div
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
            role="alert"
          >
            {loadError}
          </div>
        )}

        {/* Tabla */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-indigo-50/40">
                  <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    ID
                  </th>
                  <th className="min-w-[200px] px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nombre
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    N.º creadores
                  </th>
                  <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="w-[200px] px-3 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && listas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-sm text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : null}
                {!loading && listas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-sm text-slate-500">
                      No hay listas que coincidan con los filtros.
                    </td>
                  </tr>
                ) : null}
                {listas.map((l, idx) => (
                  <tr
                    key={l.id}
                    className={cn(
                      "transition-colors hover:bg-slate-50/80",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    )}
                  >
                    <td className="max-w-[140px] truncate px-3 py-3 align-middle font-mono text-xs text-slate-500">
                      {l.id.slice(0, 13)}…
                    </td>
                    <td className="px-3 py-3 align-middle font-medium text-slate-900">{l.nombre}</td>
                    <td className="px-3 py-3 text-center align-middle tabular-nums text-slate-700">
                      {l.num_creators}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          l.status === "inactivo"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-50 text-emerald-800"
                        )}
                      >
                        {listaStatusLabel(l.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Link
                          to={`/dashboard/listas/${l.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-purple/30 hover:text-purple"
                        >
                          <HiOutlinePencilSquare className="h-4 w-4" />
                          Editar
                        </Link>
                        <button
                          type="button"
                          disabled={rowBusyId === l.id}
                          onClick={() => void onDownload(l)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
                        >
                          <HiOutlineArrowDownTray className="h-4 w-4" />
                          Excel
                        </button>
                        <button
                          type="button"
                          disabled={rowBusyId === l.id}
                          onClick={() => void onDelete(l)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-rose-50/80 px-2 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
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
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lista-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-label="Cerrar"
            onClick={closeModal}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-300/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="lista-modal-title" className="text-lg font-bold text-slate-900">
              Crear lista
            </h2>
            <form onSubmit={(e) => void submitModal(e)} className="mt-4 space-y-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Nombre</span>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm !text-slate-900 placeholder:text-slate-400 focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/15"
                  placeholder="Nombre de la lista"
                  maxLength={255}
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600">Status</span>
                <Select<ListOption, false, GroupBase<ListOption>>
                  instanceId="lista-modal-status"
                  inputId="lista-modal-status-input"
                  classNamePrefix="react-select-lista-modal-status"
                  styles={selectListStyles}
                  options={LISTA_STATUS_FILTER}
                  value={formStatus}
                  onChange={(opt: SingleValue<ListOption>) =>
                    setFormStatus(opt ?? LISTA_STATUS_FILTER[0])
                  }
                  menuPosition="fixed"
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
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
                  className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white hover:bg-purple/90 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
