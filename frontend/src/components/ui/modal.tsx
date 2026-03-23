import { useEffect } from "react";
import { createPortal } from "react-dom";
import { HiOutlineXMark } from "react-icons/hi2";

import { cn } from "../../lib/utils";

const sizeClass = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
  full: "max-w-[min(96vw,1400px)]",
} as const;

export type ModalSize = keyof typeof sizeClass;

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: ModalSize;
  /** Contenido fijo bajo el área scroll (p. ej. acciones). */
  footer?: React.ReactNode;
  /** id para aria-labelledby (por defecto modal-title). */
  titleId?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "lg",
  footer,
  titleId = "modal-title",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-label="Cerrar diálogo"
      />
      <div
        className={cn(
          "relative flex max-h-[min(92vh,920px)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15",
          sizeClass[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/98 to-white px-5 py-4">
          <div className="min-w-0 pr-2">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
