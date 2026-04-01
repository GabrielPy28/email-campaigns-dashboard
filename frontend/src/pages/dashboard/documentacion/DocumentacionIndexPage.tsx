import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HiOutlineArrowRight, HiOutlineBookOpen } from "react-icons/hi2";
import { DOCUMENTATION_SECTIONS } from "./content";
import { cn } from "../../../lib/utils";

function SectionCardVisual({ src, title }: { src?: string; title: string }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-indigo-100/60 to-violet-100/50">
        <span className="text-2xl font-bold text-indigo-300/90">{title.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.02]"
      onError={() => setOk(false)}
    />
  );
}

export function DocumentacionIndexPage() {
  return (
    <div>
      <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-12 sm:px-10 sm:py-14 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, white 0%, transparent 45%),
              radial-gradient(circle at 80% 60%, rgba(255,255,255,0.35) 0%, transparent 40%)`,
          }}
        />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <HiOutlineBookOpen className="h-4 w-4" />
            Manual de usuario integrado
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Documentación de la plataforma
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-lg">
            Guía paso a paso para usar el panel de campañas, audiencia e informes. Elija un tema en
            el índice lateral o en las tarjetas siguientes. Cada sección incluye avisos de seguridad
            y cumplimiento cuando aplica.
          </p>
        </div>
      </div>

      <div className="p-6 sm:p-8 lg:p-10">
        <p className="mb-6 text-sm font-medium text-slate-500 uppercase tracking-wide">
          Acceso directo por tema
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {DOCUMENTATION_SECTIONS.map((section, index) => (
            <motion.li
              key={section.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.4) }}
            >
              <Link
                to={`/dashboard/documentacion/${section.slug}`}
                className={cn(
                  "group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white",
                  "shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/10"
                )}
              >
                <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50/80">
                  <SectionCardVisual src={section.cardImage} title={section.title} />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                    {section.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                    {section.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                    Leer sección
                    <HiOutlineArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
