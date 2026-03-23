import { useState } from "react";
import { cn } from "../lib/utils";

interface AvatarWithFallbackProps {
  name?: string;
  email?: string;
  avatarUrl?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

/**
 * Muestra la imagen del avatar; si falla (p. ej. por permisos/token) muestra
 * la inicial en mayúscula del nombre o del email.
 */
export function AvatarWithFallback({
  name = "",
  email = "",
  avatarUrl,
  className,
  imageClassName,
  fallbackClassName,
}: AvatarWithFallbackProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !loadFailed;
  const initial = (name || email || "?").charAt(0).toUpperCase();

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt=""
        role="presentation"
        className={cn("rounded-full border border-slate-200 object-cover", imageClassName, className)}
        onError={() => setLoadFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full border border-slate-200/90 bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center text-purple-900 font-semibold text-sm shrink-0 shadow-sm",
        fallbackClassName,
        className
      )}
      aria-hidden
    >
      {initial}
    </div>
  );
}
