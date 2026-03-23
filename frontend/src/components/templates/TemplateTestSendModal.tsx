import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Select, { type GroupBase, type MultiValue } from "react-select";
import Swal from "sweetalert2";
import {
  type CreatorRead,
  fetchCreatorsTest,
  fetchListasTest,
  fetchSenders,
  sendCampaignTest,
  type ListaRead,
  type SenderRead,
} from "../../lib/api";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { SnippetVariableSelect } from "./SnippetVariableSelect";
import {
  creatorTestMultiSelectStyles,
  listaTestSingleSelectStyles,
  senderMultiSelectStyles,
  type CreatorTestSelectOption,
  type ListaTestSelectOption,
  type SenderSelectOption,
} from "./templateTestSendSelectStyles";

const MAX_RECIPIENTS = 25;

type Mode = "list" | "creators";

type Props = {
  open: boolean;
  onClose: () => void;
  templateHtml: string;
  disabled?: boolean;
};

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

export function TemplateTestSendModal({ open, onClose, templateHtml, disabled }: Props) {
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [senders, setSenders] = useState<SenderRead[]>([]);
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [listas, setListas] = useState<ListaRead[]>([]);
  const [listTestId, setListTestId] = useState("");
  const [mode, setMode] = useState<Mode>("list");
  const [creators, setCreators] = useState<CreatorRead[]>([]);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [creatorDirectory, setCreatorDirectory] = useState<Record<string, CreatorRead>>({});
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadCreatorsError, setLoadCreatorsError] = useState<string | null>(null);
  const destModeGroupId = useId();

  const senderOptions = useMemo<SenderSelectOption[]>(
    () =>
      senders.map((s) => ({
        value: s.id,
        label: `${s.full_name} (${s.email})`,
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
    () => listaOptions.find((o) => o.value === listTestId) ?? null,
    [listaOptions, listTestId]
  );

  useEffect(() => {
    setCreatorDirectory((prev) => {
      const next = { ...prev };
      for (const c of creators) next[c.id] = c;
      return next;
    });
  }, [creators]);

  const creatorOptions = useMemo(() => {
    const byId = new Map<string, CreatorTestSelectOption>();
    for (const c of creators) {
      byId.set(c.id, toCreatorOption(c));
    }
    for (const id of selectedCreatorIds) {
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
  }, [creators, selectedCreatorIds, creatorDirectory]);

  const creatorSelectValue = useMemo(
    () => creatorOptions.filter((o) => selectedCreatorIds.has(o.value)),
    [creatorOptions, selectedCreatorIds]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [s, l] = await Promise.all([fetchSenders(), fetchListasTest({})]);
        if (cancelled) return;
        setSenders(s);
        setListas(l);
        setSenderIds((prev) => (prev.length > 0 ? prev : s.length === 1 ? [s[0].id] : prev));
      } catch {
        if (!cancelled) {
          setSenders([]);
          setListas([]);
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadCreators = useCallback(async (search: string) => {
    setLoadCreatorsError(null);
    setLoadingCreators(true);
    try {
      const rows = await fetchCreatorsTest({ search: search.trim() || undefined, limit: 300 }, []);
      setCreators(rows);
    } catch (e) {
      setCreators([]);
      setLoadCreatorsError(e instanceof Error ? e.message : "No se pudieron cargar los creadores de prueba");
    } finally {
      setLoadingCreators(false);
    }
  }, []);

  useEffect(() => {
    if (!open || mode !== "creators") return;
    const t = window.setTimeout(() => {
      void loadCreators(creatorSearch);
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, mode, creatorSearch, loadCreators]);

  function onSendersChange(newVal: MultiValue<SenderSelectOption>) {
    setSenderIds(newVal?.map((x) => x.value) ?? []);
  }

  function onCreatorsChange(newVal: MultiValue<CreatorTestSelectOption>) {
    const arr = newVal ?? [];
    if (arr.length > MAX_RECIPIENTS) {
      void Swal.fire({
        icon: "info",
        title: "Límite alcanzado",
        text: `Máximo ${MAX_RECIPIENTS} destinatarios por envío de prueba.`,
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    setSelectedCreatorIds(new Set(arr.map((x) => x.value)));
  }

  async function handleSendTest() {
    const html = templateHtml.trim();
    if (!html) {
      void Swal.fire({
        icon: "warning",
        title: "Sin HTML",
        text: "Escribe contenido en la plantilla antes de enviar la prueba.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    const subj = subject.trim();
    if (!subj) {
      void Swal.fire({
        icon: "warning",
        title: "Asunto obligatorio",
        text: "Indica el asunto del correo de prueba.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    if (senderIds.length < 1) {
      void Swal.fire({
        icon: "warning",
        title: "Remitente",
        text: "Selecciona al menos un remitente.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }

    if (mode === "list") {
      if (!listTestId) {
        void Swal.fire({
          icon: "warning",
          title: "Lista de prueba",
          text: "Elige una lista de listas_test.",
          confirmButtonColor: "#7c3aed",
        });
        return;
      }
    } else {
      if (selectedCreatorIds.size < 1) {
        void Swal.fire({
          icon: "warning",
          title: "Destinatarios",
          text: "Selecciona al menos un creador de prueba.",
          confirmButtonColor: "#7c3aed",
        });
        return;
      }
    }

    setSending(true);
    try {
      const base = {
        subject: subj,
        preheader: preheader.trim() || null,
        template_html: html,
        sender_ids: senderIds,
      };
      const payload =
        mode === "list"
          ? { ...base, list_test_id: listTestId }
          : { ...base, creator_test_ids: Array.from(selectedCreatorIds) };

      const res = await sendCampaignTest(payload);
      const lines = res.results.map(
        (r) => `${r.email}: ${r.status}${r.error ? ` (${r.error})` : ""}`
      );
      await Swal.fire({
        icon: res.failed > 0 ? "warning" : "success",
        title: "Envío de prueba",
        html: `<p class="text-left text-sm">Enviados: ${res.sent} · Fallidos: ${res.failed}</p><pre class="text-xs text-left mt-2 max-h-48 overflow-auto whitespace-pre-wrap">${lines.join("\n")}</pre>`,
        confirmButtonColor: "#7c3aed",
        width: 560,
      });
      onClose();
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: e instanceof Error ? e.message : "No se pudo enviar la prueba",
        confirmButtonColor: "#7c3aed",
      });
    } finally {
      setSending(false);
    }
  }

  const busy = disabled || sending || loadingMeta;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar correo de prueba"
      description={`Usa una lista de listas_test o elige creadores en creators_test. Máximo ${MAX_RECIPIENTS} destinatarios por envío.`}
      size="lg"
      titleId="template-test-send-modal-title"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <Button
            type="button"
            onClick={() => void handleSendTest()}
            disabled={busy || !templateHtml.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white border-0 shadow-sm"
          >
            {sending ? "Enviando…" : loadingMeta ? "Cargando…" : "Enviar prueba ahora"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <p className="text-xs leading-relaxed text-slate-600">
          El <span className="font-medium text-slate-700">asunto</span> y el{" "}
          <span className="font-medium text-slate-700">preheader</span> usan el mismo contexto Jinja2 que el cuerpo: los
          valores siguen viniendo de las tablas de creador y cuentas; en las etiquetas verás{" "}
          <code className="text-amber-900/90 bg-amber-50 px-1 rounded">extra</code> porque el motor expone ese objeto
          (rellenado desde columnas conocidas), no porque sea un origen distinto a la base de datos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">Asunto *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder='Ej. Hola {{ extra.creator.first_name }}'
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
            <SnippetVariableSelect
              disabled={busy}
              onInsert={(snippet) => setSubject((s) => s + snippet)}
              instanceId="tpl-subject-snippet"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-800 mb-1">Preheader (opcional)</label>
            <input
              type="text"
              value={preheader}
              onChange={(e) => setPreheader(e.target.value)}
              placeholder="Texto de vista previa (también admite {{ … }} )"
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            />
            <SnippetVariableSelect
              disabled={busy}
              onInsert={(snippet) => setPreheader((s) => s + snippet)}
              instanceId="tpl-preheader-snippet"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-800 mb-1.5" htmlFor="template-test-senders-select">
            Remitentes * (round-robin, sin límite)
          </label>
          <Select<SenderSelectOption, true, GroupBase<SenderSelectOption>>
            inputId="template-test-senders-select"
            instanceId="template-test-senders"
            isMulti
            options={senderOptions}
            value={senderSelectValue}
            onChange={(v) => onSendersChange((v ?? []) as MultiValue<SenderSelectOption>)}
            placeholder={loadingMeta ? "Cargando remitentes…" : "Selecciona uno o más remitentes…"}
            isDisabled={busy}
            isLoading={loadingMeta}
            closeMenuOnSelect={false}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
            styles={senderMultiSelectStyles}
            noOptionsMessage={() => "No hay remitentes"}
          />
        </div>

        <fieldset className="space-y-2 border-0 p-0 m-0">
          <legend className="text-xs font-medium text-slate-800 mb-1">Destinatarios del envío</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              htmlFor={`${destModeGroupId}-list`}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 shadow-sm transition-colors ${
                mode === "list"
                  ? "border-amber-400 bg-amber-50/90 ring-1 ring-amber-300/80"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                id={`${destModeGroupId}-list`}
                type="radio"
                name={destModeGroupId}
                checked={mode === "list"}
                onChange={() => setMode("list")}
                disabled={busy}
                className="h-4 w-4 shrink-0 border-slate-400 text-amber-600 focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-sm font-medium leading-snug text-slate-900">
                Lista de prueba <span className="font-normal text-slate-600">(listas_test)</span>
              </span>
            </label>
            <label
              htmlFor={`${destModeGroupId}-creators`}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 shadow-sm transition-colors ${
                mode === "creators"
                  ? "border-amber-400 bg-amber-50/90 ring-1 ring-amber-300/80"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                id={`${destModeGroupId}-creators`}
                type="radio"
                name={destModeGroupId}
                checked={mode === "creators"}
                onChange={() => setMode("creators")}
                disabled={busy}
                className="h-4 w-4 shrink-0 border-slate-400 text-amber-600 focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-sm font-medium leading-snug text-slate-900">
                Creadores de prueba <span className="font-normal text-slate-600">(creators_test)</span>
              </span>
            </label>
          </div>
        </fieldset>

        {mode === "list" ? (
          <div className="rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/50 via-white to-white p-4 shadow-sm ring-1 ring-violet-100/60">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <label className="text-sm font-semibold text-violet-950" htmlFor="template-test-list-select">
                Lista de prueba *
              </label>
              <span className="text-xs text-violet-700/90">Busca por nombre y revisa cuántos creadores incluye</span>
            </div>
            <Select<ListaTestSelectOption, false, GroupBase<ListaTestSelectOption>>
              inputId="template-test-list-select"
              instanceId="template-test-lista"
              options={listaOptions}
              value={listaSelectValue}
              onChange={(opt) => setListTestId(opt?.value ?? "")}
              placeholder={
                loadingMeta ? "Cargando listas…" : "Buscar o elegir una lista de listas_test…"
              }
              isDisabled={busy}
              isLoading={loadingMeta}
              isClearable
              isSearchable
              formatOptionLabel={(data) => <ListaOptionLabel data={data} />}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={listaTestSingleSelectStyles}
              noOptionsMessage={({ inputValue }) =>
                inputValue ? `Sin coincidencias para “${inputValue}”` : "No hay listas de prueba"
              }
            />
            {listaSelectValue ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <span className="inline-flex rounded-md bg-violet-100/90 px-2 py-0.5 font-medium text-violet-900">
                  {listaSelectValue.num_creators} creadores
                </span>
                <span>en esta lista (máx. {MAX_RECIPIENTS} por envío si aplica).</span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white p-4 shadow-sm ring-1 ring-emerald-100/70">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <label className="text-sm font-semibold text-emerald-950" htmlFor="template-test-creators-select">
                Creadores de prueba *
              </label>
              <span className="text-xs font-medium tabular-nums text-emerald-900">
                {selectedCreatorIds.size} / {MAX_RECIPIENTS} seleccionados
              </span>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-600">
              Escribe en el campo para buscar por correo o nombre. Los chips muestran el correo; en el menú verás correo y
              nombre completo.
            </p>
            <Select<CreatorTestSelectOption, true, GroupBase<CreatorTestSelectOption>>
              inputId="template-test-creators-select"
              instanceId="template-test-creators"
              isMulti
              options={creatorOptions}
              value={creatorSelectValue}
              onChange={(v) => onCreatorsChange((v ?? []) as MultiValue<CreatorTestSelectOption>)}
              onInputChange={(v, meta) => {
                if (meta.action === "input-change") setCreatorSearch(v);
              }}
              filterOption={() => true}
              placeholder="Buscar y seleccionar creadores de prueba…"
              isDisabled={busy}
              isLoading={loadingCreators}
              closeMenuOnSelect={false}
              hideSelectedOptions={false}
              formatOptionLabel={(data) => <CreatorOptionLabel data={data} />}
              getOptionValue={(o) => o.value}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={creatorTestMultiSelectStyles}
              loadingMessage={() => "Buscando creadores…"}
              noOptionsMessage={({ inputValue }) =>
                loadingCreators
                  ? "Cargando…"
                  : inputValue
                    ? `Sin resultados para “${inputValue}”`
                    : "Escribe para buscar o abre el menú"
              }
            />
            {loadCreatorsError ? <p className="mt-2 text-sm text-rose-600">{loadCreatorsError}</p> : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
