import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { DateTime } from "luxon";
import {
  fetchTemplates,
  fetchTemplate,
  fetchSenders,
  createTemplateFromHtml,
  createCampaign,
  fetchCampaignDetail,
  updateCampaign,
  type CampaignReadDetail,
  type TemplateRead,
  type TemplateDetail,
  type SenderRead,
  type RecipientInput,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";
import { UTC_OFFSETS, getCountriesByOffset } from "../../lib/timezoneUtils";
import { isValidSchedule, toLuxonZone } from "../../lib/scheduleValidation";
import { HiOutlineArrowLeft, HiOutlineArrowDownTray } from "react-icons/hi2";

const RECIPIENT_COLUMNS = [
  "email",
  "first_name",
  "last_name",
  "username",
  "handle_instagram",
  "handle_tiktok",
  "youtube_channel",
  "youtube_url",
  "vertical",
  "instagram_followers",
  "tiktok_followers",
  "youtube_subscribers",
] as const;
const REQUIRED_COLUMNS = ["email", "first_name"] as const;

function normalizeHeader(h: string): string {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function parseRecipientsFile(file: File): Promise<RecipientInput[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("No se pudo leer el archivo"));
          return;
        }
        const wb = XLSX.read(data, { type: "binary", raw: false });
        const firstSheet = wb.SheetNames[0];
        if (!firstSheet) {
          reject(new Error("El archivo no tiene hojas"));
          return;
        }
        const ws = wb.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
          raw: false,
        });
        if (rows.length === 0) {
          reject(new Error("El archivo no tiene filas de datos"));
          return;
        }
        const headers = Object.keys(rows[0]).map(normalizeHeader);
        const missing = REQUIRED_COLUMNS.filter(
          (c) => !headers.includes(c.toLowerCase())
        );
        if (missing.length > 0) {
          reject(
            new Error(
              `Faltan columnas obligatorias: ${missing.join(", ")}. Requeridas: email, first_name`
            )
          );
          return;
        }
        const get = (row: Record<string, unknown>, key: string) => {
          const k = Object.keys(row).find(
            (h) => normalizeHeader(h) === key.toLowerCase()
          );
          const v = k ? row[k] : undefined;
          return v != null ? String(v).trim() : "";
        };
        const recipients: RecipientInput[] = rows.map((row, i) => {
          const email = get(row, "email");
          const first_name = get(row, "first_name");
          const last_name = get(row, "last_name");
          const username = get(row, "username");
          const nombre =
            first_name + (last_name ? ` ${last_name}` : "");
          const id = email || `row-${i + 1}`;
          const extra: Record<string, unknown> = {};
          RECIPIENT_COLUMNS.forEach((col) => {
            if (!["email", "first_name", "last_name", "username"].includes(col)) {
              const val = get(row, col);
              if (val) extra[col] = val;
            }
          });
          return {
            id,
            email,
            nombre,
            username: username || email || first_name,
            ...extra,
          };
        });
        resolve(recipients);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Error al procesar archivo"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsBinaryString(file);
  });
}

function downloadLayoutExcel() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...RECIPIENT_COLUMNS]]);
  XLSX.utils.book_append_sheet(wb, ws, "Destinatarios");
  XLSX.writeFile(wb, "destinatarios_layout.xlsx");
}

function downloadLayoutCsv() {
  const header = RECIPIENT_COLUMNS.join(",");
  const blob = new Blob([header + "\n"], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "destinatarios_layout.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function NuevaCampanaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditing = Boolean(editId);
  const [templates, setTemplates] = useState<TemplateRead[]>([]);
  const [senders, setSenders] = useState<SenderRead[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [templateMode, setTemplateMode] = useState<"list" | "custom">("list");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customHtml, setCustomHtml] = useState("");
  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<RecipientInput[]>([]);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("UTC-4");
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [waitMin, setWaitMin] = useState(60);
  const [waitMax, setWaitMax] = useState(120);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewPreheader, setPreviewPreheader] = useState("");

  useEffect(() => {
    Promise.all([fetchTemplates(), fetchSenders()])
      .then(async ([t, s]) => {
        setTemplates(t);
        setSenders(s);
        if (t.length > 0 && !selectedTemplateId) setSelectedTemplateId(t[0].id);
        if (s.length > 0 && senderIds.length === 0) setSenderIds([s[0].id]);

        if (editId) {
          try {
            const details: CampaignReadDetail = await fetchCampaignDetail(editId);
            setName(details.name);
            setSubject(details.subject ?? "");
            setPreheader(details.preheader ?? "");
            setSelectedTemplateId(details.template_id);
            const dt = DateTime.fromISO(details.scheduled_at);
            if (dt.isValid) {
              setScheduleDate(dt.toISODate() ?? "");
              setScheduleTime(dt.toFormat("HH:mm"));
            }
            setTimezone(details.timezone || "UTC");
            setWaitMin(details.wait_min_seconds);
            setWaitMax(details.wait_max_seconds);
            if (details.sender_ids && details.sender_ids.length > 0) {
              setSenderIds(details.sender_ids);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error al cargar campaña para edición");
          }
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar datos"))
      .finally(() => setLoadingMeta(false));
  }, [editId]);

  const loadPreviewTemplate = useCallback(() => {
    if (templateMode === "custom") {
      setPreviewHtml(customHtml);
    } else if (selectedTemplateId) {
      fetchTemplate(selectedTemplateId)
        .then((t: TemplateDetail) => setPreviewHtml(t.html_content || ""))
        .catch(() => setPreviewHtml(""));
    } else {
      setPreviewHtml("");
    }
    setPreviewSubject(subject);
    setPreviewPreheader(preheader);
  }, [templateMode, customHtml, selectedTemplateId, subject, preheader]);

  useEffect(() => {
    loadPreviewTemplate();
  }, [loadPreviewTemplate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecipientsFile(file);
    setRecipientsError(null);
    parseRecipientsFile(file)
      .then(setRecipients)
      .catch((err) => {
        setRecipientsError(err instanceof Error ? err.message : "Error");
        setRecipients([]);
      });
  };

  const handleScheduleBlur = () => {
    if (!scheduleDate || !scheduleTime) return;
    const valid = isValidSchedule(scheduleDate, scheduleTime, timezone);
    setScheduleError(valid ? null : "La fecha/hora de envío debe ser mayor a la actual en la zona seleccionada.");
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError("El nombre de la campaña es obligatorio.");
      return;
    }
    if (!isEditing && recipients.length === 0) {
      setSubmitError("Sube un archivo de destinatarios (Excel/CSV) con columnas email y first_name.");
      return;
    }
    if (senderIds.length === 0) {
      setSubmitError("Selecciona al menos un remitente.");
      return;
    }
    if (waitMin < 1 || waitMax < 1) {
      setSubmitError("Los tiempos de espera deben ser al menos 1 segundo.");
      return;
    }
    if (waitMax < waitMin) {
      setSubmitError("El tiempo máximo de espera debe ser >= al mínimo.");
      return;
    }
    const valid = isValidSchedule(scheduleDate, scheduleTime, timezone);
    if (!valid) {
      setScheduleError("La fecha/hora de envío debe ser mayor a la actual en la zona seleccionada.");
      return;
    }
    setScheduleError(null);

    let templateId = selectedTemplateId;
    if (templateMode === "custom") {
      if (!customHtml.trim()) {
        setSubmitError("Escribe o pega el HTML de la plantilla.");
        return;
      }
      setSubmitting(true);
      try {
        const created = await createTemplateFromHtml(
          `Campaña: ${name.slice(0, 50)}`,
          customHtml
        );
        templateId = created.id;
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Error al crear plantilla");
        setSubmitting(false);
        return;
      }
    } else if (!templateId) {
      setSubmitError("Selecciona una plantilla.");
      return;
    }

    const scheduledDt = DateTime.fromISO(`${scheduleDate}T${scheduleTime}`, {
      zone: toLuxonZone(timezone),
    });
    const scheduled = scheduledDt.toFormat("yyyy-MM-dd'T'HH:mm:ss");
    if (!scheduledDt.isValid) {
      setSubmitError("Fecha/hora inválida.");
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editId) {
        await updateCampaign(editId, {
          name: name.trim(),
          subject: subject.trim() || null,
          preheader: preheader.trim() || null,
          template_id: templateId,
          scheduled_at: scheduled ?? undefined,
          timezone,
          wait_min_seconds: waitMin,
          wait_max_seconds: waitMax,
        });
        await Swal.fire({
          icon: "success",
          title: "Campaña actualizada",
          text: "Los cambios de la campaña se guardaron correctamente.",
          confirmButtonColor: "#16a34a",
        });
      } else {
        await createCampaign({
          name: name.trim(),
          subject: subject.trim() || null,
          preheader: preheader.trim() || null,
          template_id: templateId,
          scheduled_at: scheduled!,
          timezone,
          wait_min_seconds: waitMin,
          wait_max_seconds: waitMax,
          sender_ids: senderIds,
          recipients,
        });
        await Swal.fire({
          icon: "success",
          title: "Campaña creada",
          text: "La campaña se registró correctamente.",
          confirmButtonColor: "#16a34a",
        });
      }
      navigate("/dashboard/campanas");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : isEditing
            ? "Error al actualizar campaña"
            : "Error al crear campaña";
      setSubmitError(msg);
      await Swal.fire({
        icon: "error",
        title: "Ocurrió un problema",
        text: msg,
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const { t } = useTranslation();
  const countriesForOffset = getCountriesByOffset(timezone);
  const getCountryNameEs = (code: string) => {
    const key = `country.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
    try {
      return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  if (loadingMeta) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/30">
      <nav className="text-sm text-slate-600 mb-2">
        <Link to="/dashboard/campanas" className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
          Campañas
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-medium">Nueva Campaña</span>
      </nav>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        <span className="text-indigo-600">Nueva</span> Campaña
      </h1>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}
      {submitError && (
        <div className="mb-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-indigo-200/60 bg-white p-4 shadow-sm border-l-4 border-l-indigo-500">
            <h2 className="text-sm font-semibold text-indigo-700 mb-3">Datos de la campaña</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ej. Newsletter Marzo 2026"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Asunto del correo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Preheader</label>
                <input
                  type="text"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Vista previa en bandeja"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200/60 bg-white p-4 shadow-sm border-l-4 border-l-violet-500">
            <h2 className="text-sm font-semibold text-violet-700 mb-3">Plantilla</h2>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="templateMode"
                  checked={templateMode === "list"}
                  onChange={() => setTemplateMode("list")}
                  className="text-violet-600"
                />
                <span className="text-sm text-slate-700">Elegir plantilla registrada</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="templateMode"
                  checked={templateMode === "custom"}
                  onChange={() => setTemplateMode("custom")}
                  className="text-violet-600"
                />
                <span className="text-sm text-slate-700">Insertar HTML</span>
              </label>
            </div>
            {templateMode === "list" ? (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Selecciona una plantilla</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={customHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                placeholder="Pega aquí el HTML del correo..."
                rows={12}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500"
              />
            )}
          </div>

          <div className="rounded-xl border border-sky-200/60 bg-white p-4 shadow-sm border-l-4 border-l-sky-500">
            <h2 className="text-sm font-semibold text-sky-700 mb-3">Destinatarios</h2>
            <p className="text-xs text-slate-500 mb-2">
              Columnas obligatorias: <strong>email</strong>, <strong>first_name</strong>. Opcionales:{" "}
              {RECIPIENT_COLUMNS.filter((c) => c !== "email" && c !== "first_name").join(", ")}.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                type="button"
                variant="ghost"
                size="default"
                className="gap-2 border border-emerald-300 bg-emerald-50 text-emerald-800 h-9 text-sm hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                onClick={downloadLayoutExcel}
              >
                <HiOutlineArrowDownTray className="h-4 w-4" />
                Descargar layout Excel
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="default"
                className="gap-2 border border-sky-300 bg-sky-50 text-sky-800 h-9 text-sm hover:bg-sky-600 hover:text-white hover:border-sky-600"
                onClick={downloadLayoutCsv}
              >
                <HiOutlineArrowDownTray className="h-4 w-4" />
                Descargar layout CSV
              </Button>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700"
            />
            {recipientsError && (
              <p className="mt-2 text-sm text-rose-600">{recipientsError}</p>
            )}
            {recipients.length > 0 && (
              <p className="mt-2 text-sm text-emerald-600">
                {recipients.length} destinatario(s) cargados.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-red-200/60 bg-white p-4 shadow-sm border-l-4 border-l-red-500">
            <h2 className="text-sm font-semibold text-red-700 mb-3">Remitente(s)</h2>
            <p className="text-xs text-slate-500 mb-3">Elige uno o más remitentes. Puedes marcar varios.</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 max-h-48 overflow-y-auto space-y-1">
              {senders.map((s) => {
                const selected = senderIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors",
                      selected ? "bg-indigo-100 border border-indigo-300" : "hover:bg-slate-100 border border-transparent"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) =>
                        setSenderIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-800">
                      {s.full_name} <span className="text-slate-500">&lt;{s.email}&gt;</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {senderIds.length > 0 && (
              <p className="mt-2 text-xs font-medium text-indigo-600">
                {senderIds.length} remitente{senderIds.length !== 1 ? "s" : ""} seleccionado{senderIds.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200/60 bg-white p-4 shadow-sm border-l-4 border-l-amber-500">
            <h2 className="text-sm font-semibold text-amber-800 mb-3">Programación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Zona horaria</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                >
                  {UTC_OFFSETS.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                {countriesForOffset.length > 0 && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Países y regiones en este horario:</p>
                    <ul className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                      {countriesForOffset.map((c) => (
                        <li key={c.code}>
                          <span className="font-medium text-slate-700">{getCountryNameEs(c.code)}</span>
                          {c.regions.length > 0 ? (
                            <span className="text-slate-600"> — {c.regions.join(", ")}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha envío *</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  onBlur={handleScheduleBlur}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hora *</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  onBlur={handleScheduleBlur}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {scheduleError && (
                <p className="sm:col-span-2 text-sm text-rose-600">{scheduleError}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Espera mín. (seg)</label>
                <input
                  type="number"
                  min={1}
                  value={waitMin}
                  onChange={(e) => setWaitMin(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Espera máx. (seg)</label>
                <input
                  type="number"
                  min={1}
                  value={waitMax}
                  onChange={(e) => setWaitMax(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="ghost"
              className="gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400"
              onClick={() => navigate("/dashboard/campanas")}
            >
              <HiOutlineArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-shadow"
            >
              {submitting ? "Creando…" : "Crear campaña"}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="rounded-xl border border-emerald-200/60 bg-white p-4 shadow-sm sticky top-4 border-l-4 border-l-emerald-500">
            <h2 className="text-sm font-semibold text-emerald-700 mb-3">Vista previa (inbox)</h2>
            <div className="rounded-lg border border-slate-200 bg-emerald-50/50 p-3 text-sm">
              {(() => {
                const selectedSenders = senders.filter((s) => senderIds.includes(s.id));
                return selectedSenders.length > 0 ? (
                  <div className="mb-2 text-slate-600 text-xs">
                    De: {selectedSenders.map((s) => `${s.full_name} <${s.email}>`).join(", ")}
                  </div>
                ) : null;
              })()}
              <div className="mb-2 truncate text-slate-500 text-xs">
                {previewSubject || "Asunto del correo"}
              </div>
              <div className="mb-2 truncate text-slate-400 text-xs">
                {previewPreheader || "Preheader / vista previa"}
              </div>
              <div
                className="rounded border border-slate-200 bg-white overflow-auto max-h-[400px] p-3 text-left"
                style={{ minHeight: "120px" }}
              >
                {previewHtml ? (
                  <iframe
                    title="Vista previa"
                    srcDoc={previewHtml}
                    className="w-full h-96 border-0 rounded"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <p className="text-slate-400 text-xs">El contenido del correo se verá aquí.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
