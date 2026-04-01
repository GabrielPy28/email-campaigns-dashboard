import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  fetchTemplates,
  fetchTemplate,
  deleteTemplate,
  downloadTemplateHtml,
  type TemplateRead,
  type TemplateDetail,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineDocumentText,
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineArrowDownTray,
  HiOutlineInformationCircle,
} from "react-icons/hi2";

const PER_PAGE = 50;

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${h}:${m}`;
}

export function PlantillasPage() {
  const [templates, setTemplates] = useState<TemplateRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedToDelete, setSelectedToDelete] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.id ?? "").toLowerCase().includes(q)
    );
  }, [templates, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, filtered.length);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetail(null);
    fetchTemplate(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleDelete = useCallback(async () => {
    if (!selectedToDelete) return;
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar plantilla?",
      text: "Esta acción no se puede revertir. ¿Continuar?",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTemplate(selectedToDelete);
      setSelectedToDelete(null);
      if (selectedId === selectedToDelete) setSelectedId(null);
      await loadTemplates();
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: e instanceof Error ? e.message : "Error al eliminar la plantilla.",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setDeleting(false);
    }
  }, [selectedToDelete, selectedId, loadTemplates]);

  const handleDownload = useCallback(async (t: TemplateRead) => {
    setDownloadId(t.id);
    try {
      await downloadTemplateHtml(t.id, `plantilla-${t.name?.replace(/[^a-z0-9-_]/gi, "_") ?? t.id}.html`);
    } finally {
      setDownloadId(null);
    }
  }, []);

  const handleDeleteRow = useCallback(
    async (id: string) => {
      const result = await Swal.fire({
        icon: "warning",
        title: "¿Eliminar plantilla?",
        text: "Esta acción no se puede revertir. ¿Continuar?",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#64748b",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });
      if (!result.isConfirmed) return;
      setDeletingId(id);
      setError(null);
      try {
        await deleteTemplate(id);
        if (selectedId === id) setSelectedId(null);
        setSelectedToDelete((prev) => (prev === id ? null : prev));
        await loadTemplates();
      } catch (e) {
        await Swal.fire({
          icon: "error",
          title: "No se pudo eliminar",
          text: e instanceof Error ? e.message : "Error al eliminar la plantilla.",
          confirmButtonColor: "#7c3aed",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [selectedId, loadTemplates]
  );

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-violet-500/12 via-transparent to-indigo-500/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
                Campañas y contenido
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Plantillas de correo
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Crea y mantén plantillas HTML reutilizables para tus envíos. Desde aquí puedes buscar
                por nombre o ID, abrir una tarjeta para ver la vista previa, descargar el HTML,
                editarla o eliminarla de forma segura con confirmación.
              </p>
              <div className="mt-4">
                <Link to="/dashboard/plantillas/nueva">
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    className="gap-2 border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <HiOutlinePlus className="h-4 w-4" />
                    Nueva plantilla
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex shrink-0 justify-end lg:max-w-md">
              <div className="flex w-full items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <div className="space-y-1 text-sky-900/90">
                  <p className="font-semibold text-sky-950">Guía rápida</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs leading-relaxed text-sky-900/85">
                    <li>
                      <strong>Selecciona</strong> una fila para ver el detalle y la vista previa a la
                      derecha.
                    </li>
                    <li>
                      Usa <strong>Descargar</strong> para guardar el HTML y revisarlo fuera del
                      panel.
                    </li>
                    <li>
                      Para redactar desde cero o duplicar flujos, entra en <strong>Nueva plantilla</strong>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion: Filtros */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors w-full sm:w-auto",
              filtersOpen
                ? "border-violet-400 bg-violet-50 text-violet-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-violet-200"
            )}
          >
            {filtersOpen ? (
              <HiOutlineChevronDown className="h-4 w-4" />
            ) : (
              <HiOutlineChevronRight className="h-4 w-4" />
            )}
            Filtros
          </button>
          {filtersOpen && (
            <div className="rounded-xl border border-violet-200/60 bg-white p-4 shadow-sm">
              <label className="block text-xs font-medium text-violet-700 mb-2">
                Filtrar por nombre o ID
              </label>
              <input
                type="text"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Escribe nombre o ID de plantilla..."
                className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
              />
            </div>
          )}
        </div>

        {/* Eliminar seleccionada */}
        {selectedToDelete && (
          <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-2">
            <span className="text-sm text-rose-800">Plantilla seleccionada para eliminar.</span>
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 text-rose-700 hover:bg-rose-100 border border-rose-300 h-8 text-sm"
            >
              <HiOutlineTrash className="h-4 w-4" />
              {deleting ? "Eliminando…" : "Eliminar plantilla"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => setSelectedToDelete(null)}
              className="text-slate-600 hover:bg-slate-100 h-8 text-sm"
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* Tabla + Previews en grid: tabla a la izquierda, previews a la derecha (o abajo en móvil) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {error && (
              <div className="p-4 text-rose-600 text-sm bg-rose-50 border-b border-rose-100">{error}</div>
            )}
            {loading ? (
              <div className="p-8 text-center text-slate-500">Cargando plantillas…</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-gradient-to-r from-violet-50 to-indigo-50 text-left">
                        <th className="p-3 font-semibold text-violet-700">ID</th>
                        <th className="p-3 font-semibold text-violet-700">Nombre</th>
                        <th className="p-3 font-semibold text-violet-700">Creado</th>
                        <th className="p-3 font-semibold text-violet-700 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                          className={cn(
                            "border-b border-slate-100 transition-colors cursor-pointer",
                            "hover:bg-violet-50/60",
                            selectedId === t.id && "bg-violet-100 border-l-4 border-l-violet-500"
                          )}
                        >
                          <td className="p-3 text-slate-600 font-mono text-xs">{t.id.slice(0, 8)}…</td>
                          <td className="p-3 text-slate-800 font-medium">
                            {t.name ?? <span className="text-slate-400 italic">Sin nombre</span>}
                          </td>
                          <td className="p-3 text-slate-500 text-xs">{formatCreatedAt(t.created_at)}</td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <Link to={`/dashboard/plantillas/editar/${t.id}`}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="default"
                                  onClick={(e) => e.stopPropagation()}
                                  className="gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 border border-amber-200 h-8 text-xs"
                                >
                                  <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                              </Link>
                              <Button
                                type="button"
                                variant="ghost"
                                size="default"
                                onClick={() => handleDownload(t)}
                                disabled={downloadId !== null}
                                className="gap-1.5 text-sky-600 hover:bg-sky-50 hover:text-sky-700 border border-sky-200 h-8 text-xs"
                              >
                                <HiOutlineArrowDownTray className="h-3.5 w-3.5" />
                                {downloadId === t.id ? "Descargando…" : "Descargar HTML"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="default"
                                onClick={() => handleDeleteRow(t.id)}
                                disabled={deletingId !== null}
                                className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-200 h-8 text-xs"
                              >
                                <HiOutlineTrash className="h-3.5 w-3.5" />
                                {deletingId === t.id ? "Eliminando…" : "Eliminar"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!loading && templates.length === 0 && (
                  <div className="p-8 text-center text-slate-500">No hay plantillas.</div>
                )}
                {!loading && filtered.length === 0 && templates.length > 0 && (
                  <div className="p-6 text-center text-amber-700 bg-amber-50 border-t border-amber-100">
                    Ninguna plantilla coincide con el filtro.
                  </div>
                )}
                {!loading && filtered.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                    <span className="text-slate-600">
                      Mostrando{" "}
                      <span className="font-medium text-violet-600">{from}–{to}</span> de{" "}
                      <span className="font-medium text-indigo-600">{filtered.length}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="gap-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-violet-200 h-9 px-3"
                      >
                        <HiOutlineChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="min-w-[8rem] text-center">
                        <span className="text-violet-600 font-medium">Página {page}</span>
                        <span className="text-slate-500"> de </span>
                        <span className="text-indigo-600 font-medium">{totalPages}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="gap-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-violet-200 h-9 px-3"
                      >
                        Siguiente
                        <HiOutlineChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Panel de vista previa: completa + móvil */}
          <div className="space-y-4">
            {!selectedId ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-500 flex flex-col items-center justify-center min-h-[200px]">
                <HiOutlineDocumentText className="h-12 w-12 text-slate-300 mb-2" />
                <p className="text-sm">Selecciona una plantilla para ver la vista previa</p>
              </div>
            ) : loadingDetail ? (
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-8 text-center text-amber-700 min-h-[200px] flex items-center justify-center">
                Cargando vista previa…
              </div>
            ) : detail ? (
              <>
                {/* Vista completa */}
                <div className="rounded-xl border-2 border-indigo-200 bg-white overflow-hidden shadow-md">
                  <div className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-semibold uppercase tracking-wider">
                    Vista completa
                  </div>
                  <div className="border-t border-slate-200 bg-white overflow-auto max-h-[420px] min-h-[200px]">
                    <iframe
                      title="Vista previa completa"
                      srcDoc={detail.html_content}
                      className="w-full min-h-[300px] border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
                {/* Vista móvil */}
                <div className="rounded-xl border-2 border-emerald-200 bg-white overflow-hidden shadow-md">
                  <div className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold uppercase tracking-wider">
                    Vista móvil
                  </div>
                  <div className="border-t border-slate-200 bg-slate-100/80 p-4 flex justify-center">
                    <div className="w-[375px] max-w-full rounded-lg border-4 border-slate-300 bg-white shadow-lg overflow-hidden flex flex-col">
                      <div className="bg-slate-400 h-2 w-12 mx-auto rounded-full my-1.5 flex-shrink-0" />
                      <div className="overflow-auto flex-1 min-h-[320px]">
                        <iframe
                          title="Vista previa móvil"
                          srcDoc={detail.html_content}
                          className="w-full min-h-[400px] border-0 block"
                          style={{ minWidth: "375px" }}
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-6 text-center text-rose-700 text-sm">
                No se pudo cargar la plantilla.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
