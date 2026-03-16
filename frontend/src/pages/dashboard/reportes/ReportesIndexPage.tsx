import { Link } from "react-router-dom";
import { HiMiniUserGroup } from "react-icons/hi2";
import { SiGoogledocs } from "react-icons/si";
import { FaUserSecret } from "react-icons/fa";
import { RiMailSendLine } from "react-icons/ri";
import { cn } from "../../../lib/utils";

const CARDS = [
  {
    to: "/dashboard/reportes/campanas",
    title: "Reporte de campañas",
    description: "Métricas y resultados por campaña.",
    icon: RiMailSendLine,
    gradient: "from-violet-500 to-violet-600",
    borderColor: "border-violet-300",
    bgHover: "hover:bg-violet-50",
  },
  {
    to: "/dashboard/reportes/senders",
    title: "Reporte por Senders",
    description: "Análisis por remitente.",
    icon: FaUserSecret,
    gradient: "from-sky-500 to-indigo-600",
    borderColor: "border-sky-200",
    bgHover: "hover:bg-sky-50",
  },
  {
    to: "/dashboard/reportes/plantillas",
    title: "Reporte por Plantillas",
    description: "Rendimiento por plantilla de correo.",
    icon: SiGoogledocs,
    gradient: "from-amber-500 to-orange-600",
    borderColor: "border-amber-200",
    bgHover: "hover:bg-amber-50",
  },
  {
    to: "/dashboard/reportes/recipientes",
    title: "Reporte por Recipientes",
    description: "Aperturas y clics por destinatario.",
    icon: HiMiniUserGroup,
    gradient: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-200",
    bgHover: "hover:bg-emerald-50",
  },
] as const;

export function ReportesIndexPage() {
  return (
    <div className="p-6 sm:p-8 min-h-full bg-gradient-to-b from-slate-50 to-indigo-50/20">
      <nav className="text-sm text-slate-600 mb-2">
        <span className="text-slate-800 font-medium">Reportes</span>
      </nav>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">
        <span className="text-indigo-600">Reportes</span>
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Selecciona el tipo de reporte que deseas consultar.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className={cn(
                "rounded-xl border-2 bg-white p-5 shadow-sm transition-all",
                card.borderColor,
                card.bgHover,
                "hover:shadow-md hover:border-opacity-80"
              )}
            >
              <div
                className={cn(
                  "inline-flex rounded-lg p-2.5 text-white bg-gradient-to-br mb-3",
                  card.gradient
                )}
              >
                <Icon className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 mb-1">{card.title}</h2>
              <p className="text-sm text-slate-500">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

