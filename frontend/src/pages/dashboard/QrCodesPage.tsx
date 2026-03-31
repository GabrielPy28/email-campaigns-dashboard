import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineClipboardDocument,
  HiOutlinePaintBrush,
  HiOutlinePlus,
  HiOutlineQrCode,
  HiOutlineTrash,
} from "react-icons/hi2";
import {
  createQrCode,
  createQrCodeMultipart,
  deleteQrCode,
  fetchQrCodeScanCount,
  fetchQrCodes,
  getApiBaseUrl,
  removeQrCodeCustomImage,
  uploadQrCodeCustomImage,
  type QrCodeListRow,
} from "../../lib/api";

/** Etiqueta legible para `YYYY-MM-DD` del bucket diario configurado en backend. */
function formatScanDay(isoDate: string): string {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return isoDate;
  const [y, mo, da] = parts;
  return new Date(Date.UTC(y, mo - 1, da)).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
import { Button } from "../../components/ui/button";
import { QrCodeDesignerModal } from "../../components/qr/QrCodeDesignerModal";

export function QrCodesPage() {
  const [rows, setRows] = useState<QrCodeListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceRowId, setReplaceRowId] = useState<string | null>(null);
  const [openDesignerAfterCreate, setOpenDesignerAfterCreate] = useState(true);
  const [designerTarget, setDesignerTarget] = useState<{
    id: string;
    trackingUrl: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQrCodes();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los códigos QR.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = targetUrl.trim();
    if (!url) {
      void Swal.fire({
        icon: "warning",
        title: "URL requerida",
        text: "Indica la URL de destino (http:// o https://).",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    setSubmitting(true);
    try {
      const created = imageFile
        ? await createQrCodeMultipart(url, name.trim() || null, imageFile)
        : await createQrCode({
            name: name.trim() || null,
            target_url: url,
          });
      setName("");
      setTargetUrl("");
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();

      if (!imageFile && openDesignerAfterCreate) {
        setDesignerTarget({ id: created.id, trackingUrl: created.tracking_url });
      } else {
        const extra =
          created.image_mode === "uploaded"
            ? " Si subiste una imagen, asegúrate de que el gráfico del QR codifique la URL de escaneo (tracking) que ves en la tabla, o los escaneos no se contarán."
            : "";
        await Swal.fire({
          icon: "success",
          title: "Código QR creado",
          text: `Ya puedes descargar o compartir la imagen desde la tabla.${extra}`,
          confirmButtonColor: "#16a34a",
        });
      }
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo crear el código.",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openReplaceFilePicker = (rowId: string) => {
    setReplaceRowId(rowId);
    requestAnimationFrame(() => replaceInputRef.current?.click());
  };

  const onReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !replaceRowId) {
      setReplaceRowId(null);
      return;
    }
    setBusyId(replaceRowId);
    try {
      await uploadQrCodeCustomImage(replaceRowId, file);
      await load();
      void Swal.fire({
        icon: "success",
        title: "Imagen actualizada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: err instanceof Error ? err.message : "No se pudo subir la imagen.",
      });
    } finally {
      setBusyId(null);
      setReplaceRowId(null);
    }
  };

  const revertToGenerated = async (row: QrCodeListRow) => {
    setBusyId(row.id);
    try {
      await removeQrCodeCustomImage(row.id);
      await load();
      void Swal.fire({
        icon: "success",
        title: "QR generado por el servidor",
        text: "Se eliminó la imagen subida; la vista pública vuelve al código generado automáticamente.",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo quitar la imagen.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      void Swal.fire({
        icon: "success",
        title: "Copiado",
        text: `${label} copiado al portapapeles.`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch {
      void Swal.fire({ icon: "error", title: "No se pudo copiar" });
    }
  };

  const refreshScans = async (id: string) => {
    setBusyId(id);
    try {
      const data = await fetchQrCodeScanCount(id);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                scan_count: data.scan_count,
                scans_by_day: data.scans_by_day ?? [],
              }
            : r
        )
      );
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo leer el contador.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: QrCodeListRow) => {
    const res = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar este código QR?",
      html: `<p class="text-sm text-slate-600">Se borrará el registro y el contador. La imagen dejará de estar disponible.</p>`,
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    setBusyId(row.id);
    try {
      await deleteQrCode(row.id);
      await load();
      void Swal.fire({
        icon: "success",
        title: "Eliminado",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo eliminar.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/30">
      <nav className="text-sm text-slate-600 mb-2">
        <Link
          to="/dashboard/pruebas"
          className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
        >
          Pruebas
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-medium">Códigos QR</span>
      </nav>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/90 to-purple-600/90 text-purple shadow-md">
            <HiOutlineQrCode className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Códigos QR</h1>
            <p className="text-sm text-slate-600 mt-0.5 max-w-xl">
              Registra un destino, muestra la imagen del QR y cuenta los escaneos (cada apertura de la URL de
              redirección). El desglose por día usa la zona horaria configurada en backend; pulsa «Refrescar contador»
              para verlo.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
            onClick={() => void load()}
            disabled={loading}
          >
            <HiOutlineArrowPath className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
            asChild
          >
            <Link to="/dashboard/campanas">
              <HiOutlineArrowLeft className="h-4 w-4" />
              Campañas
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-xl border border-indigo-200/60 bg-white p-4 shadow-sm border-l-4 border-l-indigo-500 h-fit">
          <h2 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
            <HiOutlinePlus className="h-4 w-4" />
            Nuevo código QR
          </h2>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre (opcional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border text-black border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ej. Flyer marzo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL de destino *</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-300 text-black bg-white px-3 py-2 text-sm"
                placeholder="https://…"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Imagen del QR (opcional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                PNG, JPEG o WEBP (máx. 2&nbsp;MB). Si la subes, úsala en material impreso solo si el QR codifica la URL
                de tracking que verás al crear el registro.
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300 text-indigo-600"
                checked={openDesignerAfterCreate}
                onChange={(e) => setOpenDesignerAfterCreate(e.target.checked)}
                disabled={Boolean(imageFile)}
              />
              <span>
                Tras registrar (sin archivo), abrir el <strong>diseñador visual</strong> para estilos y logo. Si
                desmarcas, se usará el QR generado por defecto.
              </span>
            </label>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? "Guardando…" : imageFile ? "Registrar con imagen" : "Registrar (QR automático)"}
            </Button>
          </form>
        </div>

        <input
          ref={replaceInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          aria-hidden
          onChange={(e) => void onReplaceFileSelected(e)}
        />

        <div className="lg:col-span-2 space-y-4">
          {loading && rows.length === 0 ? (
            <p className="text-slate-500 text-sm">Cargando…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-slate-500 text-sm">
              No hay códigos QR todavía. Crea uno con el formulario.
            </div>
          ) : (
            <ul className="space-y-4">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4"
                >
                  <div className="shrink-0 flex justify-center sm:justify-start">
                    <a
                      href={row.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-slate-200 bg-slate-50 p-2 hover:ring-2 hover:ring-indigo-200 transition-shadow"
                      title="Abrir imagen en nueva pestaña"
                    >
                      <img
                        key={`${row.id}-${row.image_revision ?? 0}`}
                        src={row.image_url}
                        alt=""
                        width={120}
                        height={120}
                        className="w-[120px] h-[120px] object-contain"
                      />
                    </a>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{row.name || "Sin nombre"}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          row.image_mode === "uploaded"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {row.image_mode === "uploaded" ? "Imagen subida" : "QR generado"}
                      </span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {new Date(row.created_at).toLocaleString("es")}
                      </span>
                    </div>
                    {row.image_mode === "uploaded" && (
                      <p className="text-[11px] text-amber-900/90 bg-amber-50 border border-amber-200/80 rounded-lg px-2 py-1.5">
                        El contador solo sube si el QR impreso codifica:{" "}
                        <code className="break-all text-[10px]">{row.tracking_url}</code>
                      </p>
                    )}
                    <p className="text-sm text-slate-600 break-all">
                      <span className="font-medium text-slate-700">Destino:</span>{" "}
                      <a
                        href={row.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {row.target_url}
                      </a>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-slate-700">Escaneos (total):</span>{" "}
                      <span className="tabular-nums text-emerald-700 font-semibold">{row.scan_count}</span>
                    </p>
                    {row.scans_by_day !== undefined ? (
                      row.scans_by_day.length > 0 ? (
                        <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
                          <p className="font-semibold text-slate-700 mb-1.5">Por día</p>
                          <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {row.scans_by_day.map((d) => (
                              <li
                                key={d.day}
                                className="flex justify-between gap-4 text-slate-600 border-b border-slate-100/80 last:border-0 pb-1 last:pb-0"
                              >
                                <span className="capitalize">{formatScanDay(d.day)}</span>
                                <span className="tabular-nums font-semibold text-slate-800">{d.count}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : row.scan_count > 0 ? (
                        <p className="text-[11px] text-slate-500">
                          Aún no hay filas por día: los próximos escaneos se irán guardando por fecha. El total incluye
                          escaneos anteriores a esta función.
                        </p>
                      ) : null
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs border border-indigo-200 text-indigo-800 hover:bg-indigo-50"
                        disabled={busyId === row.id}
                        onClick={() =>
                          setDesignerTarget({ id: row.id, trackingUrl: row.tracking_url })
                        }
                      >
                        <HiOutlinePaintBrush className="h-3.5 w-3.5 mr-1" />
                        Diseñador
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => void copyText("URL de la imagen", row.image_url)}
                      >
                        <HiOutlineClipboardDocument className="h-3.5 w-3.5 mr-1" />
                        Copiar URL imagen
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => void copyText("URL de escaneo (tracking)", row.tracking_url)}
                      >
                        Copiar URL escaneo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
                        disabled={busyId === row.id}
                        onClick={() => openReplaceFilePicker(row.id)}
                      >
                        {row.image_mode === "uploaded" ? "Cambiar imagen" : "Subir imagen"}
                      </Button>
                      {row.image_mode === "uploaded" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
                          disabled={busyId === row.id}
                          onClick={() => void revertToGenerated(row)}
                        >
                          Usar QR generado
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
                        disabled={busyId === row.id}
                        onClick={() => void refreshScans(row.id)}
                      >
                        <HiOutlineArrowPath className={`h-3.5 w-3.5 mr-1 ${busyId === row.id ? "animate-spin" : ""}`} />
                        Refrescar contador
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs border border-rose-200 text-rose-700 hover:bg-rose-50"
                        disabled={busyId === row.id}
                        onClick={() => void handleDelete(row)}
                      >
                        <HiOutlineTrash className="h-3.5 w-3.5 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {designerTarget ? (
        <QrCodeDesignerModal
          open
          onClose={() => setDesignerTarget(null)}
          qrCodeId={designerTarget.id}
          trackingUrl={designerTarget.trackingUrl}
          onApplied={() => void load()}
        />
      ) : null}
    </div>
  );
}
