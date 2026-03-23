import { useCallback, useEffect, useState } from "react";
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

const MAX_RECIPIENTS = 25;

type Mode = "list" | "creators";

type Props = {
  templateHtml: string;
  disabled?: boolean;
};

export function TemplateTestSendPanel({ templateHtml, disabled }: Props) {
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
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadCreatorsError, setLoadCreatorsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [s, l] = await Promise.all([fetchSenders(), fetchListasTest({})]);
        if (cancelled) return;
        setSenders(s);
        setListas(l);
        if (s.length === 1) setSenderIds([s[0].id]);
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
  }, []);

  const loadCreators = useCallback(async (search: string) => {
    setLoadCreatorsError(null);
    try {
      const rows = await fetchCreatorsTest({ search: search.trim() || undefined, limit: 300 }, []);
      setCreators(rows);
    } catch (e) {
      setCreators([]);
      setLoadCreatorsError(e instanceof Error ? e.message : "No se pudieron cargar los creadores de prueba");
    }
  }, []);

  useEffect(() => {
    if (mode !== "creators") return;
    const t = window.setTimeout(() => {
      void loadCreators(creatorSearch);
    }, 350);
    return () => window.clearTimeout(t);
  }, [mode, creatorSearch, loadCreators]);

  function toggleSender(id: string) {
    setSenderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleCreator(id: string) {
    setSelectedCreatorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_RECIPIENTS) {
          void Swal.fire({
            icon: "info",
            title: "Límite alcanzado",
            text: `Máximo ${MAX_RECIPIENTS} destinatarios por envío de prueba.`,
            confirmButtonColor: "#7c3aed",
          });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
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
    <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-sm max-w-3xl">
      <h2 className="text-sm font-semibold text-amber-900 mb-1">Enviar correo de prueba</h2>
      <p className="text-xs text-amber-900/80 mb-4">
        Usa datos de <span className="font-medium">listas_test</span> o elige creadores en{" "}
        <span className="font-medium">creators_test</span>. Máximo {MAX_RECIPIENTS} destinatarios por envío.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Asunto *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Asunto del correo de prueba"
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Preheader (opcional)</label>
          <input
            type="text"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="Texto de vista previa"
            disabled={busy}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
        </div>
      </div>

      <div className="mb-3">
        <span className="block text-xs font-medium text-slate-700 mb-2">Remitentes * (round-robin)</span>
        <div className="flex flex-wrap gap-3 max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
          {senders.length === 0 && !loadingMeta ? (
            <span className="text-sm text-slate-500">No hay remitentes (GET /senders/).</span>
          ) : (
            senders.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={senderIds.includes(s.id)}
                  onChange={() => toggleSender(s.id)}
                  disabled={busy}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-slate-700">
                  {s.full_name} <span className="text-slate-500">&lt;{s.email}&gt;</span>
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="testDestMode"
            checked={mode === "list"}
            onChange={() => setMode("list")}
            disabled={busy}
            className="text-amber-600 focus:ring-amber-500"
          />
          Lista de prueba (listas_test)
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="testDestMode"
            checked={mode === "creators"}
            onChange={() => setMode("creators")}
            disabled={busy}
            className="text-amber-600 focus:ring-amber-500"
          />
          Creadores de prueba (creators_test)
        </label>
      </div>

      {mode === "list" ? (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 mb-1">Lista *</label>
          <select
            value={listTestId}
            onChange={(e) => setListTestId(e.target.value)}
            disabled={busy}
            className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">Selecciona una lista…</option>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre} ({l.num_creators} creadores)
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-700 mb-1">Buscar creadores</label>
              <input
                type="search"
                value={creatorSearch}
                onChange={(e) => setCreatorSearch(e.target.value)}
                placeholder="Correo o nombre…"
                disabled={busy}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <span className="text-xs text-slate-600 pb-2">
              Seleccionados: {selectedCreatorIds.size}/{MAX_RECIPIENTS}
            </span>
          </div>
          {loadCreatorsError && (
            <p className="text-sm text-rose-600">{loadCreatorsError}</p>
          )}
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
            {creators.map((c) => {
              const checked = selectedCreatorIds.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-amber-50/50 ${
                    checked ? "bg-amber-50/40" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCreator(c.id)}
                    disabled={busy}
                    className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <span className="font-medium text-slate-800">{c.email}</span>
                    {(c.full_name || c.first_name || c.last_name) && (
                      <span className="text-slate-600">
                        {" "}
                        — {c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
            {creators.length === 0 && !loadCreatorsError && (
              <p className="p-3 text-sm text-slate-500">No hay resultados. Ajusta la búsqueda.</p>
            )}
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={() => void handleSendTest()}
        disabled={busy || !templateHtml.trim()}
        className="bg-amber-600 hover:bg-amber-700 text-white border-0"
      >
        {sending ? "Enviando…" : loadingMeta ? "Cargando…" : "Enviar prueba ahora"}
      </Button>
    </div>
  );
}
