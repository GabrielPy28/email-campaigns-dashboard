import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import Swal from "sweetalert2";
import { fetchTemplate, updateTemplate } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { TEMPLATE_VARIABLES } from "../../lib/templateVariables";

export function EditarPlantillaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  function insertVariable(expression: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits("", [{ range: selection, text: expression }]);
    editor.focus();
  }

  const loadTemplate = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplate(id);
      setName(data.name ?? "");
      setHtmlContent(data.html_content ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la plantilla");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      await updateTemplate(id, {
        name: name.trim() || null,
        html_content: htmlContent.trim(),
      });
      await Swal.fire({
        icon: "success",
        title: "Cambios guardados",
        text: "La plantilla se ha actualizado correctamente.",
        confirmButtonColor: "#7c3aed",
      });
      navigate("/dashboard/plantillas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la plantilla");
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) {
    return (
      <div className="p-6 sm:p-8">
        <p className="text-rose-600">ID de plantilla no válido.</p>
        <Link to="/dashboard/plantillas" className="text-violet-600 hover:underline mt-2 inline-block">
          Volver a plantillas
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
        <p className="text-slate-500">Cargando plantilla…</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
      <nav className="text-sm text-slate-600 mb-2">
        <Link
          to="/dashboard/plantillas"
          className="text-violet-600 hover:text-violet-700 font-medium hover:underline"
        >
          Plantillas
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-medium">Editar plantilla</span>
      </nav>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        <span className="text-amber-600">Editar</span> plantilla
      </h1>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-violet-200/60 bg-white p-4 shadow-sm max-w-3xl">
          <label className="block text-sm font-medium text-violet-700 mb-2">Nombre (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Newsletter marzo 2026"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-violet-200/60 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-violet-700 mb-2">Contenido HTML *</label>
            <div className="rounded-lg border border-slate-300 overflow-hidden min-h-[420px]">
              <Editor
                height="420px"
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
                  padding: { top: 12 },
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                }}
                loading={
                  <div className="flex items-center justify-center h-[420px] text-slate-500 text-sm">
                    Cargando editor…
                  </div>
                }
              />              
            </div>
            <br style={{ marginBottom: "10px" }} />
            {/* Etiquetas dinámicas */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800 mb-2">Etiquetas de contenido dinámico</p>
                <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                  Para personalizar aún más tu página, puedes usar pequeñas &quot;etiquetas especiales&quot; que funcionan como
                  bloques de contenido dinámico.
                </p>
                <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                  Solo tienes que escribir la etiqueta que necesitas o hacer clic en una de la lista y automáticamente
                  aparecerá en el lugar donde tengas el cursor dentro del editor.
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <ul className="divide-y divide-slate-200 max-h-44 overflow-y-auto">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <li key={v.column}>
                        <button
                          type="button"
                          onClick={() => insertVariable(v.expression)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-violet-50/80 transition-colors group"
                        >
                          <span className="text-slate-600 group-hover:text-violet-700">{v.description}</span>
                          <code className="text-xs font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded shrink-0">
                            {v.expression}
                          </code>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
          </div>
          <div className="space-y-4">
            {/* Vista desktop */}
            <div className="rounded-xl border-2 border-indigo-200 bg-white overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-semibold uppercase tracking-wider">
                Vista desktop
              </div>
              <div className="border-t border-slate-200 bg-white overflow-auto min-h-[400px] max-h-[420px]">
                {htmlContent.trim() ? (
                  <iframe
                    title="Vista previa desktop"
                    srcDoc={htmlContent}
                    className="w-full min-h-[400px] border-0 block"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-slate-400 text-sm">
                    Escribe o pega HTML para ver la vista previa
                  </div>
                )}
              </div>
            </div>
            {/* Vista móvil */}
            <div className="rounded-xl border-2 border-emerald-200 bg-white overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold uppercase tracking-wider">
                Vista móvil
              </div>
              <div className="border-t border-slate-200 bg-slate-100/80 p-4 flex justify-center">
                <div className="w-[375px] max-w-full rounded-lg border-4 border-slate-300 bg-white shadow-lg overflow-hidden flex flex-col">
                  <div className="bg-slate-400 h-2 w-12 mx-auto rounded-full my-1.5 flex-shrink-0" />
                  <div className="overflow-auto flex-1 min-h-[320px]">
                    {htmlContent.trim() ? (
                      <iframe
                        title="Vista previa móvil"
                        srcDoc={htmlContent}
                        className="w-full min-h-[400px] border-0 block"
                        style={{ minWidth: "375px" }}
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[320px] text-slate-400 text-xs">
                        Vista previa
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={submitting}
            className="bg-violet-600 hover:bg-violet-700 text-white border-0"
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </Button>
          <Link to="/dashboard/plantillas">
            <Button type="button" variant="ghost" className="border border-slate-300 text-slate-700">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
