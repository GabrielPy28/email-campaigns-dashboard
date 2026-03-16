import { Link } from "react-router-dom";

export function ReportesRecipientesPage() {
  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
      <nav className="text-sm text-slate-600 mb-2">
        <Link to="/dashboard/reportes" className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
          Reportes
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800 font-medium">Recipientes</span>
      </nav>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        <span className="text-emerald-600">Reporte</span> por Recipientes
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Contenido por construir. Aquí se mostrará el reporte por destinatarios con breadcrumb Reportes / Recipientes y al seleccionar uno, Reportes / Recipientes / Nombre o email.
      </div>
    </div>
  );
}
