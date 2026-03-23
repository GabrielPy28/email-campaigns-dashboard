import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select, {
  type GroupBase,
  type MultiValue,
  type SingleValue,
  type StylesConfig,
} from "react-select";
import Swal from "sweetalert2";
import {
  type CreatorRead,
  fetchCreatorsTest,
  previewCampaignTest,
  sendCampaignTest,
  type SenderRead,
} from "../../lib/api";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import {
  creatorTestMultiSelectStyles,
  listaTestSingleSelectStyles,
  type CreatorTestSelectOption,
} from "../templates/templateTestSendSelectStyles";

const MAX_TEST = 25;

type Props = {
  open: boolean;
  onClose: () => void;
  templateHtml: string;
  subject: string;
  preheader: string;
  senderIds: string[];
  senders: SenderRead[];
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

function CreatorOptionLabel({ data }: { data: CreatorTestSelectOption }) {
  return (
    <div className="flex flex-col gap-0.5 py-0.5 text-left">
      <span className="font-semibold text-slate-900">{data.email}</span>
      <span className="text-xs font-normal text-slate-500">{data.displayName}</span>
    </div>
  );
}

export function CampaignPreviewModal({
  open,
  onClose,
  templateHtml,
  subject,
  preheader,
  senderIds,
  senders,
}: Props) {
  const [creators, setCreators] = useState<CreatorRead[]>([]);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [creatorDirectory, setCreatorDirectory] = useState<Record<string, CreatorRead>>({});
  const [previewCreatorId, setPreviewCreatorId] = useState("");
  const [sendTestIds, setSendTestIds] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewPreheader, setPreviewPreheader] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const initSendRef = useRef(false);

  const loadCreators = useCallback(async (search: string) => {
    setLoadingCreators(true);
    try {
      const rows = await fetchCreatorsTest({ search: search.trim() || undefined, limit: 500 });
      setCreators(rows);
    } catch {
      setCreators([]);
    } finally {
      setLoadingCreators(false);
    }
  }, []);

  useEffect(() => {
    setCreatorDirectory((prev) => {
      const next = { ...prev };
      for (const c of creators) next[c.id] = c;
      return next;
    });
  }, [creators]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void loadCreators(creatorSearch), 350);
    return () => window.clearTimeout(t);
  }, [open, creatorSearch, loadCreators]);

  useEffect(() => {
    if (!open) {
      initSendRef.current = false;
      setPreviewCreatorId("");
      setSendTestIds([]);
      setCreatorSearch("");
      setPreviewHtml("");
      setPreviewSubject("");
      setPreviewPreheader(null);
      setPreviewError(null);
      return;
    }
    void loadCreators("");
  }, [open, loadCreators]);

  useEffect(() => {
    if (!open || creators.length === 0) return;
    setPreviewCreatorId((prev) => {
      if (prev && creators.some((c) => c.id === prev)) return prev;
      return creators[0].id;
    });
    if (!initSendRef.current) {
      initSendRef.current = true;
      setSendTestIds([creators[0].id]);
    }
  }, [open, creators]);

  const creatorOptions = useMemo(() => {
    const byId = new Map<string, CreatorTestSelectOption>();
    for (const c of creators) {
      byId.set(c.id, toCreatorOption(c));
    }
    for (const id of sendTestIds) {
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
    if (previewCreatorId && !byId.has(previewCreatorId)) {
      const c = creatorDirectory[previewCreatorId];
      if (c) byId.set(previewCreatorId, toCreatorOption(c));
      else {
        byId.set(previewCreatorId, {
          value: previewCreatorId,
          label: previewCreatorId,
          email: previewCreatorId,
          displayName: "…",
        });
      }
    }
    return [...byId.values()];
  }, [creators, sendTestIds, previewCreatorId, creatorDirectory]);

  const previewSingleValue = useMemo(
    () => creatorOptions.find((o) => o.value === previewCreatorId) ?? null,
    [creatorOptions, previewCreatorId]
  );

  const sendMultiValue = useMemo(
    () => creatorOptions.filter((o) => sendTestIds.includes(o.value)),
    [creatorOptions, sendTestIds]
  );

  const primarySender = useMemo(() => {
    const first = senderIds[0];
    if (!first) return null;
    return senders.find((s) => s.id === first) ?? null;
  }, [senderIds, senders]);

  useEffect(() => {
    if (!open || !previewCreatorId || !templateHtml.trim()) {
      setPreviewHtml("");
      setPreviewSubject("");
      setPreviewPreheader(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await previewCampaignTest({
          template_html: templateHtml,
          subject: subject.trim(),
          preheader: preheader.trim() || null,
          creator_test_id: previewCreatorId,
          sender_id: senderIds[0] ?? null,
        });
        if (!cancelled) {
          setPreviewHtml(res.html);
          setPreviewSubject(res.subject);
          setPreviewPreheader(res.preheader);
        }
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : "Error al generar vista previa");
          setPreviewHtml("");
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, previewCreatorId, templateHtml, subject, preheader, senderIds]);

  async function handleSendTest() {
    const html = templateHtml.trim();
    if (!html) {
      void Swal.fire({
        icon: "warning",
        title: "Sin plantilla",
        text: "Define el HTML de la plantilla antes de enviar la prueba.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    if (senderIds.length === 0) {
      void Swal.fire({
        icon: "warning",
        title: "Remitentes",
        text: "Selecciona al menos un remitente en el formulario de la campaña.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    if (sendTestIds.length === 0) {
      void Swal.fire({
        icon: "warning",
        title: "Destinatarios de prueba",
        text: "Selecciona al menos un creador de prueba.",
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    if (sendTestIds.length > MAX_TEST) {
      void Swal.fire({
        icon: "info",
        title: "Límite",
        text: `Máximo ${MAX_TEST} destinatarios por envío de prueba.`,
        confirmButtonColor: "#7c3aed",
      });
      return;
    }
    setSending(true);
    try {
      const result = await sendCampaignTest({
        subject: subject.trim() || "(sin asunto)",
        preheader: preheader.trim() || null,
        template_html: html,
        sender_ids: senderIds,
        creator_test_ids: sendTestIds,
      });
      await Swal.fire({
        icon: result.failed > 0 ? "warning" : "success",
        title: result.failed > 0 ? "Prueba parcial" : "Prueba enviada",
        html: `<p>Enviados: <strong>${result.sent}</strong> / ${result.num_recipients}</p>`,
        confirmButtonColor: "#16a34a",
      });
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

  const fromLine = primarySender
    ? `${primarySender.full_name} <${primarySender.email}>`
    : senderIds.length
      ? "Remitente"
      : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vista previa y envío de prueba"
      description="Render con creadores de prueba (mismos datos Jinja2 que el envío real). El correo de prueba usa esta plantilla y los remitentes elegidos en la campaña."
      size="full"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Cerrar
          </button>
          <Button
            type="button"
            disabled={sending || !templateHtml.trim() || senderIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => void handleSendTest()}
          >
            {sending ? "Enviando…" : "Enviar prueba con datos de la campaña"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="camp-prev-creator">
            Previsualizar como (creador de prueba)
          </label>
          <Select<CreatorTestSelectOption, false, GroupBase<CreatorTestSelectOption>>
            inputId="camp-prev-creator"
            instanceId="camp-prev-creator"
            options={creatorOptions}
            value={previewSingleValue}
            onChange={(v: SingleValue<CreatorTestSelectOption>) =>
              setPreviewCreatorId(v?.value ?? "")
            }
            placeholder="Selecciona un creador de prueba…"
            isLoading={loadingCreators}
            isClearable={false}
            filterOption={() => true}
            onInputChange={(input, meta) => {
              if (meta.action === "input-change") setCreatorSearch(input);
            }}
            formatOptionLabel={(opt) => <CreatorOptionLabel data={opt} />}
            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            menuPosition="fixed"
            styles={
              listaTestSingleSelectStyles as unknown as StylesConfig<
                CreatorTestSelectOption,
                false,
                GroupBase<CreatorTestSelectOption>
              >
            }
            noOptionsMessage={() => "Sin resultados"}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5" htmlFor="camp-prev-send-multi">
            Enviar prueba a (creadores test, máx. {MAX_TEST})
          </label>
          <Select<CreatorTestSelectOption, true, GroupBase<CreatorTestSelectOption>>
            inputId="camp-prev-send-multi"
            instanceId="camp-prev-send-multi"
            isMulti
            options={creatorOptions}
            value={sendMultiValue}
            onChange={(v) => {
              const arr = ((v ?? []) as MultiValue<CreatorTestSelectOption>).map((o) => o.value);
              if (arr.length > MAX_TEST) {
                void Swal.fire({
                  icon: "info",
                  title: "Límite",
                  text: `Máximo ${MAX_TEST} destinatarios por prueba.`,
                  confirmButtonColor: "#7c3aed",
                });
                return;
              }
              setSendTestIds(arr);
            }}
            placeholder="Selecciona uno o más…"
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
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Simulación de bandeja</p>
          <div className="text-xs text-slate-600 mb-1">
            <span className="text-slate-400">De:</span> {fromLine}
          </div>
          <div className="font-medium text-slate-800 text-sm mb-1 truncate">
            {loadingPreview ? "…" : previewSubject || "(sin asunto)"}
          </div>
          <div className="text-xs text-slate-500 truncate mb-3">
            {loadingPreview ? "…" : previewPreheader || " "}
          </div>
          <div
            className="rounded-lg border border-slate-200 bg-white overflow-hidden"
            style={{ minHeight: "min(55vh, 480px)" }}
          >
            {previewError ? (
              <p className="p-4 text-sm text-rose-600">{previewError}</p>
            ) : loadingPreview ? (
              <div className="flex items-center justify-center p-12 text-sm text-slate-500">
                Generando vista previa…
              </div>
            ) : previewHtml ? (
              <iframe
                title="Vista previa renderizada"
                srcDoc={previewHtml}
                className="w-full border-0 bg-white"
                style={{ minHeight: "min(55vh, 480px)", height: "55vh" }}
                sandbox="allow-same-origin"
              />
            ) : (
              <p className="p-4 text-sm text-slate-500">
                {!templateHtml.trim()
                  ? "Completa la plantilla en el formulario para ver el render."
                  : "Selecciona un creador de prueba."}
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
