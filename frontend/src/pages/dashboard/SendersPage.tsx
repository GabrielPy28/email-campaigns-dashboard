import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  fetchSenders,
  createSender,
  updateSender,
  deleteSender,
  type SenderRead,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineInformationCircle,
} from "react-icons/hi2";

const PER_PAGE = 50;

export function SendersPage() {
  const [senders, setSenders] = useState<SenderRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editModal, setEditModal] = useState<SenderRead | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSenders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSenders();
      setSenders(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar remitentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSenders();
  }, [loadSenders]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return senders;
    return senders.filter(
      (s) =>
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.full_name ?? "").toLowerCase().includes(q) ||
        (s.id ?? "").toLowerCase().includes(q)
    );
  }, [senders, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, filtered.length);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const email = createEmail.trim();
    if (!email) {
      setError("El correo es obligatorio.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createSender({ full_name: createName.trim() || email, email });
      await Swal.fire({
        icon: "success",
        title: "Remitente registrado",
        text: "El remitente se ha creado correctamente.",
        confirmButtonColor: "#7c3aed",
      });
      setCreateEmail("");
      setCreateName("");
      setCreateFormOpen(false);
      await loadSenders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  }, [createEmail, createName, loadSenders]);

  const openEditModal = useCallback((s: SenderRead) => {
    setEditModal(s);
    setEditEmail(s.email ?? "");
    setEditName(s.full_name ?? "");
  }, []);

  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    const email = editEmail.trim();
    if (!email) {
      setError("El correo es obligatorio.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateSender(editModal.id, { full_name: editName.trim() || email, email });
      await Swal.fire({
        icon: "success",
        title: "Datos actualizados",
        text: "El remitente se ha actualizado correctamente.",
        confirmButtonColor: "#7c3aed",
      });
      setEditModal(null);
      await loadSenders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setSubmitting(false);
    }
  }, [editModal, editEmail, editName, loadSenders]);

  const handleDelete = useCallback(async (s: SenderRead) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar remitente?",
      text: "Esta acción no se puede revertir. ¿Continuar?",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;
    setDeletingId(s.id);
    setError(null);
    try {
      await deleteSender(s.id);
      await Swal.fire({
        icon: "success",
        title: "Remitente eliminado",
        text: "El remitente se ha eliminado correctamente.",
        confirmButtonColor: "#7c3aed",
      });
      await loadSenders();
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo eliminar",
        text: e instanceof Error ? e.message : "El remitente puede estar en uso en campañas programadas o en ejecución.",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setDeletingId(null);
    }
  }, [loadSenders]);

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-sky-500/12 via-transparent to-indigo-500/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Campañas y envío
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Remitentes
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Define las direcciones y nombres que aparecerán como remitente en tus campañas.
                Puedes <strong>dar de alta</strong> nuevos correos, <strong>editarlos</strong>,
                buscarlos por email, nombre o ID y <strong>eliminarlos</strong> cuando el sistema lo
                permita (si no están en uso).
              </p>
            </div>
            <div className="flex shrink-0 justify-end lg:max-w-md">
              <div className="flex w-full items-start gap-2 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                <HiOutlineInformationCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <div className="space-y-1 text-sky-900/90">
                  <p className="font-semibold text-sky-950">Guía rápida</p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs leading-relaxed text-sky-900/85">
                    <li>
                      Usa <strong>Nuevo remitente</strong> para registrar un correo que luego podrás
                      elegir al programar envíos.
                    </li>
                    <li>
                      <strong>Filtros</strong> acotan la tabla sin salir de la página.
                    </li>
                    <li>
                      Si no puedes eliminar uno, suele estar vinculado a una campaña en curso o
                      programada.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion: Filtros + Nuevo remitente */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                filtersOpen
                  ? "border-sky-400 bg-sky-50 text-sky-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-sky-200"
              )}
            >
              {filtersOpen ? (
                <HiOutlineChevronDown className="h-4 w-4" />
              ) : (
                <HiOutlineChevronRight className="h-4 w-4" />
              )}
              Filtros
            </button>
            <button
              type="button"
              onClick={() => setCreateFormOpen((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                createFormOpen
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-emerald-200"
              )}
            >
              {createFormOpen ? (
                <HiOutlineChevronDown className="h-4 w-4" />
              ) : (
                <HiOutlineChevronRight className="h-4 w-4" />
              )}
              <HiOutlinePlus className="h-4 w-4" />
              Nuevo remitente
            </button>
          </div>

          {filtersOpen && (
            <div className="rounded-xl border border-sky-200/60 bg-white p-4 shadow-sm">
              <label className="block text-xs font-medium text-sky-700 mb-2">Filtrar por email, nombre o ID</label>
              <input
                type="text"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
                placeholder="Escribe email, nombre o ID..."
                className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
              />
            </div>
          )}

          {createFormOpen && (
            <form onSubmit={handleCreate} className="rounded-xl border border-emerald-200/60 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-emerald-800 mb-3">Registrar remitente</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                >
                  {submitting ? "Guardando…" : "Registrar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateFormOpen(false)}
                  className="border border-slate-300 text-slate-700"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
        )}

        {/* Tabla */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando remitentes…</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-gradient-to-r from-sky-50 to-indigo-50 text-left">
                      <th className="p-3 font-semibold text-sky-700">ID</th>
                      <th className="p-3 font-semibold text-sky-700">Nombre</th>
                      <th className="p-3 font-semibold text-sky-700">Email</th>
                      <th className="p-3 font-semibold text-sky-700 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-100 transition-colors hover:bg-sky-50/60"
                      >
                        <td className="p-3 text-slate-600 font-mono text-xs">{s.id.slice(0, 8)}…</td>
                        <td className="p-3 text-slate-800 font-medium">{s.full_name}</td>
                        <td className="p-3 text-slate-600">{s.email}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="default"
                              onClick={() => openEditModal(s)}
                              className="gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 border border-amber-200 h-8 text-xs"
                            >
                              <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="default"
                              onClick={() => handleDelete(s)}
                              disabled={deletingId !== null}
                              className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-200 h-8 text-xs"
                            >
                              <HiOutlineTrash className="h-3.5 w-3.5" />
                              {deletingId === s.id ? "Eliminando…" : "Eliminar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!loading && senders.length === 0 && (
                <div className="p-8 text-center text-slate-500">No hay remitentes.</div>
              )}
              {!loading && filtered.length === 0 && senders.length > 0 && (
                <div className="p-6 text-center text-amber-700 bg-amber-50 border-t border-amber-100">
                  Ningún remitente coincide con el filtro.
                </div>
              )}
              {!loading && filtered.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                  <span className="text-slate-600">
                    Mostrando <span className="font-medium text-sky-600">{from}–{to}</span> de{" "}
                    <span className="font-medium text-indigo-600">{filtered.length}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="gap-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 h-9 px-3"
                    >
                      <HiOutlineChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="min-w-[8rem] text-center">
                      <span className="text-sky-600 font-medium">Página {page}</span>
                      <span className="text-slate-500"> de </span>
                      <span className="text-indigo-600 font-medium">{totalPages}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="gap-1 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 h-9 px-3"
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
      </div>

      {/* Modal Editar */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditModal(null)}>
          <div
            className="rounded-xl border border-slate-200 bg-white shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Editar remitente</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditModal(null)}
                  className="border border-slate-300 text-slate-700"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="bg-sky-600 hover:bg-sky-700 text-white border-0">
                  {submitting ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
