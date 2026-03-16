/** Usuario devuelto por POST /auth/login */
export interface LoginUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
}

export const LANETA_TOKEN_KEY = "laneta_token";
export const LANETA_USER_KEY = "laneta_user";

export function getStoredUser(): LoginUser | null {
  try {
    const raw = localStorage.getItem(LANETA_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const u = parsed as Record<string, unknown>;
    const id = u.id;
    const email = u.email;
    if (id == null || email == null) return null;
    const name =
      typeof u.name === "string" ? u.name : String(u.name ?? "");
    const avatarUrl =
      u.avatar_url ?? u.avatarUrl;
    const avatar_url =
      typeof avatarUrl === "string" ? avatarUrl : String(avatarUrl ?? "");
    return {
      id: String(id),
      email: String(email),
      name,
      avatar_url,
    };
  } catch {
    // ignore
  }
  return null;
}

export function hasStoredToken(): boolean {
  try {
    return !!localStorage.getItem(LANETA_TOKEN_KEY);
  } catch {
    return false;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(LANETA_TOKEN_KEY);
    localStorage.removeItem(LANETA_USER_KEY);
  } catch {
    // ignore
  }
}
