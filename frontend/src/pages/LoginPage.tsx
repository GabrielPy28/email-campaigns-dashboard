import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiMail, FiLock } from "react-icons/fi";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import { Button } from "../components/ui/button";
import { AvatarWithFallback } from "../components/AvatarWithFallback";
import { cn } from "../lib/utils";
import {
  type LoginUser,
  getStoredUser,
  LANETA_USER_KEY,
  LANETA_TOKEN_KEY,
  hasStoredToken,
} from "../lib/auth";

const LOGO_URL =
  "https://la-neta-videos-ubicacion.s3.us-east-1.amazonaws.com/logo_optimizado.png";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<LoginUser | null>(null);
  const hasToken = hasStoredToken();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(121,188,247,0.16),transparent_55%),radial-gradient(circle_at_bottom,_rgba(102,65,237,0.2),transparent_55%)] pointer-events-none" />

      <div className="relative w-full max-w-5xl grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
            La Neta | Global Media Review Inc.
          </div>
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="La Neta logo"
              className="h-10 w-10 rounded-lg bg-slate-900/80 p-1.5 border border-slate-700/60"
            />
            <div className="text-2xl font-extrabold tracking-tight text-slate-50">
              La <span className="text-purple">Neta</span>
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-50">
              La puerta de acceso a{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">
                tu inteligencia de medios
              </span>
              .
            </h1>
            <p className="text-slate-300 max-w-xl text-sm sm:text-base leading-relaxed">
              Antes de entrar al ecosistema de dashboards y reportes, esta es tu
              sala de control.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 text-xs sm:text-sm">
            <MetricPill label="Campañas activas" value="En tiempo real" />
            <MetricPill label="Cobertura" value="Global media review" />
            <MetricPill label="Seguridad" value="Token-first access" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-slate-900/80 border border-slate-700/70 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950/60 backdrop-blur-md"
        >
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-50">
              Acceso a La Neta
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              Ingresa tus credenciales para generar o validar tu token de
              acceso.
            </p>
          </div>

          {hasToken && user && (
            <div className="mb-4 rounded-lg border border-emerald-600/60 bg-emerald-900/20 px-3 py-3 text-xs text-emerald-200">
              <p className="mb-2">Sesión activa en este navegador.</p>
              <div className="flex items-center gap-3 mt-2">
                <AvatarWithFallback
                  name={user.name}
                  email={user.email}
                  avatarUrl={user.avatar_url}
                  className="h-9 w-9"
                  imageClassName="border-emerald-500/50"
                  fallbackClassName="border-emerald-500/50 bg-emerald-800/40 text-emerald-200"
                />
                <div className="min-w-0">
                  <p className="font-medium text-slate-100 truncate">
                    {user.name || user.email}
                  </p>
                  {user.name && user.name !== user.email && (
                    <p className="text-emerald-200/90 truncate">{user.email}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSubmitting(true);
              try {
                const baseUrl =
                  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
                const resp = await fetch(`${baseUrl}/auth/login`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email, password }),
                });

                if (!resp.ok) {
                  let message = "No se pudo iniciar sesión.";
                  try {
                    const data = await resp.json();
                    if (data?.detail)
                      message =
                        typeof data.detail === "string"
                          ? data.detail
                          : data.detail[0]?.msg || message;
                  } catch {
                    // ignore
                  }
                  throw new Error(message);
                }

                const data = await resp.json();
                const token: string | undefined = data?.access_token;
                if (!token)
                  throw new Error(
                    "La respuesta del servidor no contiene un token de acceso."
                  );

                const u = data?.user;
                const loginUser: LoginUser =
                  u && typeof u === "object"
                    ? {
                        id: typeof u.id === "string" ? u.id : String(u.id ?? ""),
                        email: typeof u.email === "string" ? u.email : String(u.email ?? ""),
                        name: typeof u.name === "string" ? u.name : String(u.name ?? ""),
                        avatar_url:
                          typeof u.avatar_url === "string"
                            ? u.avatar_url
                            : String(u.avatar_url ?? ""),
                      }
                    : {
                        id: "",
                        email: data?.user?.email ?? email,
                        name: "",
                        avatar_url: "",
                      };

                localStorage.setItem(LANETA_TOKEN_KEY, token);
                localStorage.setItem(LANETA_USER_KEY, JSON.stringify(loginUser));
                setUser(loginUser);
                navigate("/dashboard", { replace: true });
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Ocurrió un error inesperado al iniciar sesión."
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className="space-y-1.5 text-sm">
              <label htmlFor="email" className="block text-xs font-medium text-slate-200">
                Correo corporativo
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <FiMail className="h-4 w-4" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-3 py-2.5",
                    "text-sm text-slate-50 placeholder:text-slate-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple focus:border-transparent"
                  )}
                  placeholder="tucorreo@laneta.media"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <label htmlFor="password" className="block text-xs font-medium text-slate-200">
                Clave de acceso
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <FiLock className="h-4 w-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "w-full rounded-lg border border-slate-700/70 bg-slate-900/60 pl-9 pr-10 py-2.5",
                    "text-sm text-slate-50 placeholder:text-slate-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple focus:border-transparent"
                  )}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-200"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <HiOutlineEyeOff className="h-4 w-4" />
                  ) : (
                    <HiOutlineEye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/70 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-purple focus:ring-0"
                />
                Recordar este dispositivo
              </label>
              <button type="button" className="text-blue hover:text-blue/80 underline underline-offset-2">
                Necesito ayuda
              </button>
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" disabled={submitting}>
              {submitting ? "Validando acceso..." : "Entrar al portal"}
            </Button>
          </form>

          <p className="mt-5 text-[11px] leading-relaxed text-slate-500">
            Al continuar aceptas las políticas internas de{" "}
            <span className="text-slate-200 font-medium">La Neta</span> sobre
            manejo de datos y uso responsable de la inteligencia de medios.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-sm font-semibold text-slate-50">{value}</div>
    </div>
  );
}
