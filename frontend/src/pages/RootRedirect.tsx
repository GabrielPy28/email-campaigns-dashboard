import { Navigate } from "react-router-dom";
import { hasStoredToken } from "../lib/auth";

/**
 * Ruta raíz: redirige a /dashboard si hay token, si no a /login.
 * Mostramos una pantalla de carga para evitar pantalla en blanco.
 */
export function RootRedirect() {
  const hasToken = hasStoredToken();
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <span className="text-slate-400 text-sm animate-pulse">Cargando…</span>
      {hasToken ? (
        <Navigate to="/dashboard" replace />
      ) : (
        <Navigate to="/login" replace />
      )}
    </div>
  );
}
