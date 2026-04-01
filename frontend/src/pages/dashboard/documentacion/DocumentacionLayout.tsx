import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { HiOutlineChevronRight, HiOutlineBars3 } from "react-icons/hi2";
import { cn } from "../../../lib/utils";
import { DOCUMENTATION_SECTIONS, getDocSectionBySlug } from "./content";

function DocBreadcrumbs() {
  const { slug } = useParams<{ slug?: string }>();
  const current = slug ? getDocSectionBySlug(slug) : null;

  return (
    <nav
      className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500"
      aria-label="Ruta de navegación"
    >
      <Link
        to="/dashboard/campanas"
        className="rounded-md px-1 py-0.5 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        Panel
      </Link>
      <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <Link
        to="/dashboard/documentacion"
        className={cn(
          "rounded-md px-1 py-0.5 transition-colors hover:bg-slate-100 hover:text-slate-800",
          !current && "font-medium text-slate-800"
        )}
      >
        Documentación
      </Link>
      {current ? (
        <>
          <HiOutlineChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="font-medium text-slate-800 truncate max-w-[min(100%,280px)]">
            {current.title}
          </span>
        </>
      ) : null}
    </nav>
  );
}

export function DocumentacionLayout() {
  const location = useLocation();
  const isIndex = location.pathname === "/dashboard/documentacion" || location.pathname.endsWith("/documentacion/");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-slate-100/90">
      <div className="mx-auto flex max-w-[1480px] gap-0 lg:gap-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* TOC sidebar */}
        <aside
          className={cn(
            "lg:w-72 shrink-0",
            mobileTocOpen ? "fixed inset-0 z-40 flex lg:relative lg:inset-auto" : "hidden lg:block"
          )}
        >
          {mobileTocOpen ? (
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/40 lg:hidden"
              aria-label="Cerrar índice"
              onClick={() => setMobileTocOpen(false)}
            />
          ) : null}
          <div
            className={cn(
              "relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm",
              mobileTocOpen &&
                "absolute right-0 top-0 z-50 h-[min(100dvh,640px)] w-[min(100%,320px)] shadow-xl lg:relative lg:h-auto lg:w-full lg:shadow-sm"
            )}
          >
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 px-4 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800/90">
                Índice
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">Temas del manual</p>
            </div>
            <nav className="flex-1 overflow-y-auto p-2" aria-label="Secciones de documentación">
              <ul className="space-y-0.5">
                <li>
                  <NavLink
                    to="/dashboard/documentacion"
                    end
                    onClick={() => setMobileTocOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "block rounded-xl px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                          : "text-slate-700 hover:bg-slate-50"
                      )
                    }
                  >
                    Inicio de la documentación
                  </NavLink>
                </li>
                {DOCUMENTATION_SECTIONS.map((s) => (
                  <li key={s.slug}>
                    <NavLink
                      to={`/dashboard/documentacion/${s.slug}`}
                      onClick={() => setMobileTocOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "block rounded-xl px-3 py-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                            : "text-slate-700 hover:bg-slate-50"
                        )
                      }
                    >
                      {s.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <DocBreadcrumbs />
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm lg:hidden"
              onClick={() => setMobileTocOpen(true)}
            >
              <HiOutlineBars3 className="h-5 w-5" />
              Índice
            </button>
          </div>

          <article
            className={cn(
              "rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40",
              isIndex ? "overflow-hidden" : "p-6 sm:p-8 lg:p-10"
            )}
          >
            <Outlet />
          </article>
        </div>
      </div>
    </div>
  );
}
