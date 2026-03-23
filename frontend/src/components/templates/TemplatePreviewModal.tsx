import { useEffect, useState } from "react";
import { HiOutlineDevicePhoneMobile, HiOutlineComputerDesktop } from "react-icons/hi2";

import { Modal } from "../ui/modal";
import { cn } from "../../lib/utils";

type View = "desktop" | "mobile";

type Props = {
  open: boolean;
  onClose: () => void;
  html: string;
};

export function TemplatePreviewModal({ open, onClose, html }: Props) {
  const [view, setView] = useState<View>("desktop");

  useEffect(() => {
    if (open) setView("desktop");
  }, [open]);

  const trimmed = html.trim();
  const hasContent = trimmed.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vista previa de la plantilla"
      description="Comprueba el aspecto del correo en pantalla ancha o en un ancho tipo móvil."
      size="2xl"
      titleId="template-preview-modal-title"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {hasContent ? "Contenido actual del editor." : "Añade HTML en el editor para ver la vista previa."}
          </p>
          <div
            className="inline-flex rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-inner"
            role="group"
            aria-label="Tipo de vista"
          >
            <button
              type="button"
              onClick={() => setView("desktop")}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                view === "desktop"
                  ? "bg-white text-violet-700 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <HiOutlineComputerDesktop className="h-4 w-4 shrink-0" aria-hidden />
              Escritorio
            </button>
            <button
              type="button"
              onClick={() => setView("mobile")}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                view === "mobile"
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <HiOutlineDevicePhoneMobile className="h-4 w-4 shrink-0" aria-hidden />
              Móvil
            </button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border border-slate-200 bg-slate-100/50 overflow-hidden",
            view === "mobile" ? "flex justify-center py-6 px-2" : ""
          )}
        >
          {view === "desktop" ? (
            <div className="min-h-[min(420px,50vh)] max-h-[min(72vh,720px)] overflow-auto bg-white">
              {hasContent ? (
                <iframe
                  title="Vista previa escritorio"
                  srcDoc={trimmed}
                  className="w-full min-h-[min(420px,50vh)] border-0 block"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-400">
                  Sin contenido para previsualizar
                </div>
              )}
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <div className="w-[min(100%,390px)] rounded-[2rem] border-[10px] border-slate-700 bg-slate-800 p-1 shadow-xl">
                <div className="overflow-hidden rounded-[1.35rem] bg-white">
                  <div className="h-6 shrink-0 bg-slate-100 flex items-center justify-center pt-1">
                    <div className="h-1.5 w-16 rounded-full bg-slate-300" aria-hidden />
                  </div>
                  <div className="max-h-[min(64vh,620px)] overflow-auto">
                    {hasContent ? (
                      <iframe
                        title="Vista previa móvil"
                        srcDoc={trimmed}
                        className="w-[375px] max-w-full min-h-[360px] border-0 block mx-auto"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="flex min-h-[240px] items-center justify-center px-4 text-center text-xs text-slate-400">
                        Sin contenido
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
