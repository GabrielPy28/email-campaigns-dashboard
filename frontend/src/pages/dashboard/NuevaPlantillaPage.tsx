import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import Swal from "sweetalert2";
import { HiOutlineEye, HiOutlinePaperAirplane } from "react-icons/hi2";
import { createTemplateFromHtml } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { TemplateCtaTrackingNote } from "../../components/templates/TemplateCtaTrackingNote";
import { TemplatePreviewModal } from "../../components/templates/TemplatePreviewModal";
import { TemplateTestSendModal } from "../../components/templates/TemplateTestSendModal";
import { TemplateVariablePicker } from "../../components/templates/TemplateVariablePicker";
import { useViewportEditorHeight } from "../../hooks/useViewportEditorHeight";

export function NuevaPlantillaPage() {
  const [name, setName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const navigate = useNavigate();
  const editorHeight = useViewportEditorHeight({ min: 520, max: 960, ratio: 0.62 });

  function insertVariable(expression: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits("", [{ range: selection, text: expression }]);
    editor.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!htmlContent.trim()) {
      setError("El contenido HTML es obligatorio.");
      return;
    }
    setSubmitting(true);
    try {
      await createTemplateFromHtml(name.trim() || "Sin nombre", htmlContent.trim());
      await Swal.fire({
        icon: "success",
        title: "Plantilla registrada",
        text: "La plantilla se ha creado correctamente.",
        confirmButtonColor: "#7c3aed",
      });
      navigate("/dashboard/plantillas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar la plantilla");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
        <nav className="text-sm text-slate-600 mb-2">
          <Link
            to="/dashboard/plantillas"
            className="text-violet-600 hover:text-violet-700 font-medium hover:underline"
          >
            Plantillas
          </Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-800 font-medium">Nueva plantilla</span>
        </nav>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="text-2xl font-bold text-slate-800 shrink-0">
            <span className="text-violet-600">Nueva</span> plantilla
          </h1>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="inline-flex items-center gap-2 border border-violet-200 bg-white text-violet-800 shadow-sm hover:bg-violet-50"
            >
              <HiOutlineEye className="h-4 w-4" aria-hidden />
              Vista previa
            </Button>
            <Button
              type="button"
              onClick={() => setTestModalOpen(true)}
              className="inline-flex items-center gap-2 bg-amber-600 text-white hover:bg-amber-700 border-0 shadow-sm"
            >
              <HiOutlinePaperAirplane className="h-4 w-4" aria-hidden />
              Enviar prueba
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm max-w-[min(96rem,100%)] mx-auto">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6 w-full max-w-[min(96rem,100%)] mx-auto"
        >
          <div className="rounded-xl border border-violet-200/60 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1">
                <label className="block text-sm font-medium text-violet-700 mb-2">
                  Nombre <span className="text-slate-500 text-xs">Requerido *</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Newsletter marzo 2026"
                  className="w-full max-w-2xl sm:max-w-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-end shrink-0 sm:pb-0.5">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                >
                  {submitting ? "Guardando…" : "Registrar plantilla"}
                </Button>
                <Link to="/dashboard/plantillas">
                  <Button type="button" variant="ghost" className="border border-slate-300 text-slate-700 bg-white">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_min(22rem,32vw)] xl:gap-8 xl:items-start">
            <div className="space-y-4 min-w-0">
              <div className="rounded-xl border border-violet-200/60 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <label className="text-sm font-medium text-violet-700">Contenido HTML *</label>
                  <span className="text-xs text-slate-500">Editor amplio · vista previa en el botón superior</span>
                </div>
                <div className="rounded-lg border border-slate-300 overflow-hidden bg-slate-50/30">
                  <Editor
                    height={editorHeight}
                    language="html"
                    value={htmlContent}
                    onChange={(v) => setHtmlContent(v ?? "")}
                    onMount={(editor) => {
                      editorRef.current = editor;
                    }}
                    theme="light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      padding: { top: 14 },
                      wordWrap: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                    loading={
                      <div
                        className="flex items-center justify-center text-slate-500 text-sm bg-white"
                        style={{ minHeight: editorHeight }}
                      >
                        Cargando editor…
                      </div>
                    }
                  />
                </div>
              </div>
              <TemplateCtaTrackingNote />
            </div>

            <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-5rem)] xl:flex xl:flex-col">
              <TemplateVariablePicker
                onInsert={insertVariable}
                className="xl:flex-1 xl:min-h-0 xl:flex xl:flex-col xl:overflow-hidden"
                scrollMaxHeightClassName="max-h-[min(36rem,62vh)] xl:max-h-[calc(100vh-12rem)] xl:flex-1 xl:min-h-0"
              />
            </aside>
          </div>
        </form>
      </div>

      <TemplateTestSendModal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        templateHtml={htmlContent}
        disabled={submitting}
      />
      <TemplatePreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        html={htmlContent}
      />
    </>
  );
}
