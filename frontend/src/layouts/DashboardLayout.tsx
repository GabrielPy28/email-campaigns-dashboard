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
} from "react-icons/hi2";
import {
  HiOutlineMail,
  HiOutlineLogout
} from "react-icons/hi";

const LOGO_URL =
  "https://la-neta-videos-ubicacion.s3.us-east-1.amazonaws.com/logo_optimizado.png";

const navItems = [
  { to: "/dashboard/campanas", label: "Campañas", icon: HiOutlineMegaphone },
  { to: "/dashboard/plantillas", label: "Plantillas", icon: HiOutlineDocumentText },
  { to: "/dashboard/senders", label: "Senders", icon: HiOutlineMail },
  { to: "/dashboard/reportes", label: "Reportes", icon: HiOutlineChartBar },
] as const;

export function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<LoginUser | null>(null);
  const hasToken = hasStoredToken();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (user) {
      console.log("Usuario logueado:", {
        name: user.name,
        email: user.email,
        id: user.id,
        avatar_url: user.avatar_url,
      });
    }
  }, [user]);

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col shadow-sm">
        {/* Logo / marca */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <img
              src={LOGO_URL}
              alt="La Neta"
              className="h-8 w-8 rounded-lg border border-slate-200"
            />
            <span className="font-bold text-slate-800">
              La <span className="text-indigo-600">Neta</span>
            </span>
          </div>
        </div>

        {/* User panel */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <AvatarWithFallback
              name={user?.name}
              email={user?.email}
              avatarUrl={user?.avatar_url}
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">
                {user?.name || user?.email || "Usuario"}
              </p>
              {user?.name && user.name !== user?.email && (
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              )}
              {user?.id && (
                <p className="text-[10px] text-slate-400 truncate mt-0.5" title={user.id}>
                  ID: {user.id.slice(0, 8)}…
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={false}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent"
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-rose-600 transition-colors"
          >
            <HiOutlineLogout className="h-5 w-5 shrink-0" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Área principal */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
