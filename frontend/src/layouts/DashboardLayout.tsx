import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { getStoredUser, hasStoredToken, clearSession } from "../lib/auth";
import type { LoginUser } from "../lib/auth";
import { AvatarWithFallback } from "../components/AvatarWithFallback";
import {
  HiOutlineMegaphone,
  HiOutlineDocumentText,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineUserGroup,
  HiOutlineBeaker,
} from "react-icons/hi2";
import { HiOutlineMail, HiOutlineLogout } from "react-icons/hi";

const LOGO_URL =
  "https://la-neta-videos-ubicacion.s3.us-east-1.amazonaws.com/logo_optimizado.png";

type Accent = "purple" | "blue" | "pink" | "brand";

const accentActive: Record<Accent, string> = {
  purple: "from-purple to-purple/85",
  blue: "from-blue to-blue/85",
  pink: "from-pink to-pink/85",
  brand: "from-purple via-blue to-pink",
};

const accentDot: Record<Accent, string> = {
  purple: "bg-purple shadow-[0_0_10px_rgba(102,65,237,0.5)]",
  blue: "bg-blue shadow-[0_0_10px_rgba(121,188,247,0.6)]",
  pink: "bg-pink shadow-[0_0_10px_rgba(255,71,172,0.55)]",
  brand: "bg-pink",
};

const navSections: {
  title: string;
  items: readonly { to: string; label: string; icon: typeof HiOutlineMegaphone; accent: Accent }[];
}[] = [
  {
    title: "Menú principal",
    items: [
      { to: "/dashboard/campanas", label: "Campañas", icon: HiOutlineMegaphone, accent: "brand" },
      { to: "/dashboard/plantillas", label: "Plantillas", icon: HiOutlineDocumentText, accent: "brand" },
      { to: "/dashboard/senders", label: "Senders", icon: HiOutlineMail, accent: "brand" },
      { to: "/dashboard/reportes", label: "Reportes", icon: HiOutlineChartBar, accent: "brand" },
    ],
  },
  {
    title: "Audiencia",
    items: [
      { to: "/dashboard/listas", label: "Listas", icon: HiOutlineClipboardDocumentList, accent: "purple" },
      { to: "/dashboard/creadores", label: "Creadores", icon: HiOutlineUserGroup, accent: "blue" },
    ],
  },
  {
    title: "Entorno de prueba",
    items: [
      { to: "/dashboard/pruebas", label: "Pruebas", icon: HiOutlineBeaker, accent: "pink" },
    ],
  },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<LoginUser | null>(null);
  const hasToken = hasStoredToken();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside
        className={cn(
          "relative w-[280px] shrink-0 flex flex-col overflow-hidden",
          "min-h-screen min-h-[100dvh]",
          "bg-[linear-gradient(180deg,#ffffff_0%,#faf8ff_9%,#f3efff_20%,#ebf3ff_36%,#f5f0ff_52%,#fff5f9_68%,#f4f6ff_82%,#f8f5ff_92%,#fafcff_100%)]",
          "border-r border-white/60 shadow-[4px_0_28px_-6px_rgba(102,65,237,0.12)]"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 min-h-full overflow-hidden"
          aria-hidden
        >
          <div
            className="absolute inset-0 min-h-full"
            style={{
              background: `
                radial-gradient(ellipse 140% 90% at 50% -30%, rgba(102, 65, 237, 0.11), transparent 58%),
                radial-gradient(ellipse 120% 80% at 100% 35%, rgba(121, 188, 247, 0.13), transparent 55%),
                radial-gradient(ellipse 130% 85% at -5% 100%, rgba(255, 71, 172, 0.09), transparent 58%),
                radial-gradient(ellipse 100% 70% at 50% 110%, rgba(102, 65, 237, 0.06), transparent 60%)
              `,
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Brand */}
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple/30 via-blue/25 to-pink/25 blur-md" />
                <img
                  src={LOGO_URL}
                  alt=""
                  className="relative h-11 w-11 rounded-xl"
                />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  La{" "}
                  <span className="text-transparent bg-clip-text bg-brand-gradient">
                    Neta
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Email & campañas</p>
              </div>
            </div>
          </div>

          {/* User */}
          <div className="px-4 pb-4">
            <div
              className={cn(
                "rounded-2xl border border-slate-200/90 bg-white/90 p-3.5",
                "shadow-sm shadow-slate-200/80 backdrop-blur-sm"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-purple/40 via-blue/30 to-pink/35 opacity-80 blur-[1px]" />
                  <AvatarWithFallback
                    name={user?.name}
                    email={user?.email}
                    avatarUrl={user?.avatar_url}
                    className="relative h-11 w-11 ring-2 ring-white"
                    imageClassName="border-slate-200"
                    fallbackClassName="border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                    {user?.name || user?.email || "Usuario"}
                  </p>
                  {user?.name && user.name !== user?.email && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-5">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500/90 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map(({ to, label, icon: Icon, accent }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={false}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                            "outline-none focus-visible:ring-2 focus-visible:ring-purple/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f6ff]",
                            isActive
                              ? "bg-white text-slate-900 shadow-md shadow-slate-300/40 border border-slate-200/90"
                              : "text-slate-600 border border-transparent hover:bg-white/80 hover:text-slate-900 hover:shadow-sm"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                                isActive
                                  ? cn(
                                      "bg-gradient-to-br text-white shadow-sm",
                                      accentActive[accent]
                                    )
                                  : "bg-slate-100/90 text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-700"
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span className="flex-1">{label}</span>
                            {isActive && (
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  accentDot[accent]
                                )}
                                aria-hidden
                              />
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div className="relative z-10 mt-auto border-t border-white/35 p-3">
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "text-slate-600 transition-colors border border-transparent",
                "hover:bg-white/55 hover:text-rose-700 hover:border-rose-100/80 hover:shadow-sm",
                "outline-none focus-visible:ring-2 focus-visible:ring-rose-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100/90 text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600">
                <HiOutlineLogout className="h-[18px] w-[18px]" />
              </span>
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
