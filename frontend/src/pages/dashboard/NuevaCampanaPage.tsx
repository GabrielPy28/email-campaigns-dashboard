import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { DateTime } from "luxon";
import Select, { type GroupBase, type MultiValue, type SingleValue } from "react-select";
import {
  fetchTemplates,
  fetchTemplate,
  fetchSenders,
  createTemplateFromHtml,
  createCampaign,
  fetchCampaignDetail,
  fetchListas,
  fetchCreators,
  updateCampaign,
  type CampaignReadDetail,
  type TemplateRead,
  type TemplateDetail,
  type SenderRead,
  type ListaRead,
  type CreatorRead,
} from "../../lib/api";
import { CampaignPreviewModal } from "../../components/campaigns/CampaignPreviewModal";
import { SnippetVariableSelect } from "../../components/templates/SnippetVariableSelect";
import { Button } from "../../components/ui/button";
import { SelectList, type ListOption } from "../../components/ui/select-list";
import {
  senderMultiSelectStyles,
  type SenderSelectOption,
  listaTestSingleSelectStyles,
  type ListaTestSelectOption,
  creatorTestMultiSelectStyles,
  type CreatorTestSelectOption,
} from "../../components/templates/templateTestSendSelectStyles";
import { useTranslation } from "react-i18next";
import { UTC_OFFSETS, getCountriesByOffset, flagEmojiFromCountryCode } from "../../lib/timezoneUtils";
import { isValidSchedule, toLuxonZone } from "../../lib/scheduleValidation";
import { HiOutlineArrowLeft } from "react-icons/hi2";

function toCreatorOption(c: CreatorRead): CreatorTestSelectOption {
  const displayName =
    c.full_name?.trim() ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    "Sin nombre";
  return {
    value: c.id,
    label: `${c.email} — ${displayName}`,
    email: c.email,
    displayName,
  };
}

function ListaOptionLabel({ data }: { data: ListaTestSelectOption }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="min-w-0 truncate font-medium text-slate-900">{data.nombre}</span>
      <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-violet-800">
        {data.num_creators} creadores
      </span>
    </div>
  );
}

function CreatorOptionLabel({ data }: { data: CreatorTestSelectOption }) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5 text-left">
      <span className="font-semibold text-slate-900">{data.email}</span>
      <span className="text-xs font-normal text-slate-500">{data.displayName}</span>
    </div>
  );
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
  const [recipientMode, setRecipientMode] = useState<"lista" | "creadores">("lista");
  const [listas, setListas] = useState<ListaRead[]>([]);
  const [creatorsSearchResults, setCreatorsSearchResults] = useState<CreatorRead[]>([]);
  const [creatorDirectory, setCreatorDirectory] = useState<Record<string, CreatorRead>>({});
  const [creatorSearch, setCreatorSearch] = useState("");
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [selectedListaId, setSelectedListaId] = useState("");
  const [campaignCreatorIds, setCampaignCreatorIds] = useState<string[]>([]);
  const [editRecipientHint, setEditRecipientHint] = useState<{
    count: number;
    fromList: boolean;
  } | null>(null);
  const [timezone, setTimezone] = useState("UTC-4");
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [waitMin, setWaitMin] = useState(60);
  const [waitMax, setWaitMax] = useState(120);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const templateOptions = useMemo<ListOption[]>(
    () => templates.map((t) => ({ value: t.id, label: t.name || t.id.slice(0, 8) })),
    [templates]
  );
  const templateSelectValue = useMemo(
    () => templateOptions.find((o) => o.value === selectedTemplateId) ?? null,
    [templateOptions, selectedTemplateId]
  );

  const timezoneOptions = useMemo<ListOption[]>(
    () => UTC_OFFSETS.map((tz) => ({ value: tz, label: tz })),
    []
  );
  const timezoneSelectValue = useMemo(
    () => timezoneOptions.find((o) => o.value === timezone) ?? null,
    [timezoneOptions, timezone]
  );

  const senderOptions = useMemo<SenderSelectOption[]>(
    () =>
      senders.map((s) => ({
        value: s.id,
        label: `${s.full_name} <${s.email}>`,
      })),
    [senders]
  );
  const senderSelectValue = useMemo(
    () => senderOptions.filter((o) => senderIds.includes(o.value)),
    [senderOptions, senderIds]
  );

  const listaOptions = useMemo<ListaTestSelectOption[]>(
    () =>
      listas.map((l) => ({
        value: l.id,
        label: l.nombre,
        nombre: l.nombre,
        num_creators: l.num_creators,
      })),
    [listas]
  );
  const listaSelectValue = useMemo(
    () => listaOptions.find((o) => o.value === selectedListaId) ?? null,
    [listaOptions, selectedListaId]
  );

  const creatorOptions = useMemo(() => {
    const byId = new Map<string, CreatorTestSelectOption>();
    for (const c of creatorsSearchResults) {
      byId.set(c.id, toCreatorOption(c));
    }
    for (const id of campaignCreatorIds) {
      if (!byId.has(id)) {
        const c = creatorDirectory[id];
        if (c) byId.set(id, toCreatorOption(c));
        else {
          byId.set(id, {
            value: id,
            label: id,
            email: id,
            displayName: "…",
          });
        }
      }
    }
    return [...byId.values()];
  }, [creatorsSearchResults, campaignCreatorIds, creatorDirectory]);

  const creatorSelectValue = useMemo(
    () => creatorOptions.filter((o) => campaignCreatorIds.includes(o.value)),
    [creatorOptions, campaignCreatorIds]
  );

  const loadCreators = useCallback(async (search: string) => {
    setLoadingCreators(true);
    try {
      const rows = await fetchCreators({
        search: search.trim() || undefined,
        limit: 500,
      });
      setCreatorsSearchResults(rows);
    } catch {
      setCreatorsSearchResults([]);
    } finally {
      setLoadingCreators(false);
    }
  }, []);

  useEffect(() => {
    setCreatorDirectory((prev) => {
      const next = { ...prev };
      for (const c of creatorsSearchResults) next[c.id] = c;
      return next;
    });
  }, [creatorsSearchResults]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCreators(creatorSearch);
    }, 350);
    return () => window.clearTimeout(t);
  }, [creatorSearch, loadCreators]);

  useEffect(() => {
    Promise.all([fetchTemplates(), fetchSenders(), fetchListas({ status: "activo" })])
      .then(async ([t, s, ls]) => {
        setTemplates(t);
        setSenders(s);
        setListas(ls);
        if (t.length > 0 && !selectedTemplateId) setSelectedTemplateId(t[0].id);
        if (s.length > 0 && senderIds.length === 0) setSenderIds([s[0].id]);
        if (ls.length > 0 && !selectedListaId) setSelectedListaId(ls[0].id);

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
            const n = details.recipients?.length ?? 0;
            const fromList = Boolean(details.list_id);
            setEditRecipientHint({ count: n, fromList });
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
  }, [templateMode, customHtml, selectedTemplateId]);

  useEffect(() => {
    loadPreviewTemplate();
  }, [loadPreviewTemplate]);

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
    if (!isEditing) {
      if (recipientMode === "lista" && !selectedListaId) {
        setSubmitError("Selecciona una lista de destinatarios.");
        return;
      }
      if (recipientMode === "creadores" && campaignCreatorIds.length === 0) {
        setSubmitError("Selecciona al menos un creador registrado.");
        return;
      }
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
        const payload = {
          name: name.trim(),
          subject: subject.trim() || null,
          preheader: preheader.trim() || null,
          template_id: templateId,
          scheduled_at: scheduled!,
          timezone,
          wait_min_seconds: waitMin,
          wait_max_seconds: waitMax,
          sender_ids: senderIds,
          ...(recipientMode === "lista"
            ? { list_id: selectedListaId }
            : { creator_ids: campaignCreatorIds }),
        };
        await createCampaign(payload);
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
  const sortedCountriesForTz = useMemo(() => {
    return [...countriesForOffset].sort((a, b) =>
      getCountryNameEs(a.code).localeCompare(getCountryNameEs(b.code), "es")
    );
  }, [countriesForOffset, timezone, t]);

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
        <span className="text-slate-800 font-medium">
          {isEditing ? "Editar campaña" : "Nueva campaña"}
        </span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-bold text-slate-800 min-w-0">
          {isEditing ? (
            <>
              <span className="text-indigo-600">Editar</span> campaña
            </>
          ) : (
            <>
              <span className="text-indigo-600">Nueva</span> campaña
            </>
          )}
        </h1>
        <div className="flex flex-wrap items-center gap-2 justify-end sm:shrink-0 sm:justify-end">
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
            variant="ghost"
            size="default"
            className="gap-2 border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 h-9 text-sm whitespace-nowrap"
            onClick={() => setPreviewModalOpen(true)}
          >
            Vista previa y envío de prueba
          </Button>
          <Button
            type="button"
            size="default"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-9 text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-shadow whitespace-nowrap"
          >
            {submitting
              ? isEditing
                ? "Guardando…"
                : "Creando…"
              : isEditing
                ? "Guardar cambios"
                : "Crear campaña"}
          </Button>
        </div>
      </div>

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

      <div className="space-y-6">
          <div className="rounded-xl border border-indigo-200/60 bg-white p-4 shadow-sm border-l-4 border-l-indigo-500">
            <h2 className="text-sm font-semibold text-indigo-700 mb-1">Datos de la campaña</h2>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              <span className="font-medium text-slate-600">Asunto</span> y{" "}
              <span className="font-medium text-slate-600">preheader</span> admiten variables Jinja2 con el mismo
              contexto que el HTML:{" "}
              <code className="rounded bg-slate-100 px-1 text-[11px] text-slate-800">{"{{ nombre }}"}</code>,{" "}
              <code className="rounded bg-slate-100 px-1 text-[11px] text-slate-800">
                {"{{ extra.creator.first_name }}"}
              </code>
              , o estilo corto <code className="rounded bg-slate-100 px-1 text-[11px]">{"{first_name}"}</code>. Usa el
              buscador debajo para insertar.
            </p>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder='Ej. Hola {{ extra.creator.first_name }}'
                />
                <SnippetVariableSelect
                  onInsert={(snippet) => setSubject((s) => s + snippet)}
                  instanceId="campana-subject-snippet"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Preheader</label>
                <input
                  type="text"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Vista previa en bandeja (también admite {{ … }} )"
                />
                <SnippetVariableSelect
                  onInsert={(snippet) => setPreheader((s) => s + snippet)}
                  instanceId="campana-preheader-snippet"
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
              <SelectList
                classNamePrefix="react-select-campana-template"
                options={templateOptions}
                value={templateSelectValue}
                onChange={(v: SingleValue<ListOption>) =>
                  setSelectedTemplateId(v?.value ?? "")
                }
                placeholder="Selecciona una plantilla"
                isClearable
                noOptionsMessage={() => "No hay plantillas"}
              />
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
            <h2 className="text-sm font-semibold text-sky-700 mb-2">Destinatarios</h2>
            {isEditing && editRecipientHint ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-sm text-slate-700">
                <p className="font-medium text-sky-900">Destinatarios fijados al crear la campaña</p>
                <p className="mt-1 text-xs text-slate-600">
                  {editRecipientHint.count} destinatario{editRecipientHint.count !== 1 ? "s" : ""}
                  {editRecipientHint.fromList
                    ? " (origen: lista guardada en la campaña)."
                    : " (origen: creadores o carga manual registrada en el servidor)."}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  No se pueden cambiar desde esta pantalla; solo metadatos, plantilla y programación.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Elige una lista existente o selecciona creadores del directorio. Los datos de plantilla
                  (variables <code className="text-[11px]">extra</code>) salen de cada creador.
                </p>
                <div className="flex flex-wrap gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientMode"
                      checked={recipientMode === "lista"}
                      onChange={() => setRecipientMode("lista")}
                      className="text-sky-600"
                    />
                    <span className="text-sm text-slate-700">Por lista</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipientMode"
                      checked={recipientMode === "creadores"}
                      onChange={() => setRecipientMode("creadores")}
                      className="text-sky-600"
                    />
                    <span className="text-sm text-slate-700">Por creadores registrados</span>
                  </label>
                </div>
                {recipientMode === "lista" ? (
                  <div>
                    <label
                      className="block text-xs font-medium text-slate-600 mb-1.5"
                      htmlFor="campana-lista-select"
                    >
                      Lista *
                    </label>
                    <Select<ListaTestSelectOption, false, GroupBase<ListaTestSelectOption>>
                      inputId="campana-lista-select"
                      instanceId="campana-lista"
                      options={listaOptions}
                      value={listaSelectValue}
                      onChange={(v: SingleValue<ListaTestSelectOption>) =>
                        setSelectedListaId(v?.value ?? "")
                      }
                      placeholder={listas.length === 0 ? "No hay listas activas" : "Selecciona una lista…"}
                      isDisabled={listas.length === 0}
                      isClearable={false}
                      formatOptionLabel={(opt) => <ListaOptionLabel data={opt} />}
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                      styles={listaTestSingleSelectStyles}
                      noOptionsMessage={() => "No hay listas"}
                    />
                    {listaSelectValue ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Se enviará a los{" "}
                        <span className="font-semibold text-sky-800">
                          {listaSelectValue.num_creators} creador
                          {listaSelectValue.num_creators !== 1 ? "es" : ""}
                        </span>{" "}
                        de esta lista.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <label
                      className="block text-xs font-medium text-slate-600 mb-1.5"
                      htmlFor="campana-creators-select"
                    >
                      Creadores *
                    </label>
                    <Select<CreatorTestSelectOption, true, GroupBase<CreatorTestSelectOption>>
                      inputId="campana-creators-select"
                      instanceId="campana-creators"
                      isMulti
                      options={creatorOptions}
                      value={creatorSelectValue}
                      onChange={(v) =>
                        setCampaignCreatorIds(
                          ((v ?? []) as MultiValue<CreatorTestSelectOption>).map((o) => o.value)
                        )
                      }
                      placeholder="Escribe para buscar por email, nombre o ID…"
                      isLoading={loadingCreators}
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      filterOption={() => true}
                      onInputChange={(input, meta) => {
                        if (meta.action === "input-change") setCreatorSearch(input);
                      }}
                      formatOptionLabel={(opt) => <CreatorOptionLabel data={opt} />}
                      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      menuPosition="fixed"
                      styles={creatorTestMultiSelectStyles}
                      noOptionsMessage={() => "Sin resultados"}
                    />
                    {campaignCreatorIds.length > 0 ? (
                      <p className="mt-2 text-xs font-medium text-emerald-800">
                        {campaignCreatorIds.length} creador
                        {campaignCreatorIds.length !== 1 ? "es" : ""} seleccionado
                        {campaignCreatorIds.length !== 1 ? "s" : ""}
                      </p>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-xl border border-red-200/60 bg-white p-4 shadow-sm border-l-4 border-l-red-500">
            <h2 className="text-sm font-semibold text-red-700 mb-3">Remitente(s)</h2>
            <p className="text-xs text-slate-500 mb-2">
              Elige uno o más remitentes (round-robin). Usa el buscador del desplegable si hay muchos.
            </p>
            <label className="block text-xs font-medium text-slate-600 mb-1.5" htmlFor="campana-senders-select">
              Remitentes *
            </label>
            <Select<SenderSelectOption, true, GroupBase<SenderSelectOption>>
              inputId="campana-senders-select"
              instanceId="campana-senders"
              isMulti
              options={senderOptions}
              value={senderSelectValue}
              onChange={(v) =>
                setSenderIds(((v ?? []) as MultiValue<SenderSelectOption>).map((o) => o.value))
              }
              placeholder={loadingMeta ? "Cargando remitentes…" : "Selecciona uno o más remitentes…"}
              isDisabled={loadingMeta}
              isLoading={loadingMeta}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={senderMultiSelectStyles}
              noOptionsMessage={() => "No hay remitentes"}
            />
            {senderIds.length > 0 && (
              <p className="mt-2 text-xs font-medium text-indigo-600">
                {senderIds.length} remitente{senderIds.length !== 1 ? "s" : ""} seleccionado
                {senderIds.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-amber-200/60 bg-white p-4 shadow-sm border-l-4 border-l-amber-500">
            <h2 className="text-sm font-semibold text-amber-800 mb-3">Programación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Zona horaria</label>
                <SelectList
                  classNamePrefix="react-select-campana-timezone"
                  options={timezoneOptions}
                  value={timezoneSelectValue}
                  onChange={(v: SingleValue<ListOption>) =>
                    setTimezone(v?.value ?? timezone)
                  }
                  placeholder="Zona horaria"
                  isClearable={false}
                  noOptionsMessage={() => "Sin opciones"}
                />
                {sortedCountriesForTz.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      Países y ciudades / regiones típicas en este offset
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {sortedCountriesForTz.map((c) => (
                        <div
                          key={c.code}
                          className="flex gap-3 rounded-xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/50 p-3 shadow-sm"
                        >
                          <span
                            className="text-2xl leading-none shrink-0 select-none"
                            title={c.code}
                            aria-hidden
                          >
                            {flagEmojiFromCountryCode(c.code)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 leading-tight">
                              {getCountryNameEs(c.code)}
                            </p>
                            {c.regions.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {c.regions.map((r) => (
                                  <span
                                    key={r}
                                    className="inline-flex max-w-full rounded-md bg-white/90 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200/80"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] text-slate-500">Todo el territorio</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
      </div>

      <CampaignPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        templateHtml={previewHtml}
        subject={subject}
        preheader={preheader}
        senderIds={senderIds}
        senders={senders}
      />
    </div>
  );
}
