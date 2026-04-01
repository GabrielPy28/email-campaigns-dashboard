import { type FormEvent, useEffect, useState } from "react";
import { submitCreatorUnsubscribe } from "../lib/api";
import { cn } from "../lib/utils";

const LOGO_URL =
  "https://la-neta-videos-ubicacion.s3.us-east-1.amazonaws.com/logo_optimizado.png";

export function BajaCreadorPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    message: string;
    creator_deactivated: boolean;
  } | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("email");
    if (q) setEmail(decodeURIComponent(q));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await submitCreatorUnsubscribe({
        full_name: fullName,
        email,
        note: note.trim() || null,
      });
      setDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t submit the form. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      lang="en"
      className="relative min-h-screen overflow-hidden bg-[#f8f6ff] text-slate-900"
    >
      {/* Background: soft base + brand orbs (aligned with dashboard) */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-[0.65]"
          style={{
            background: `
              radial-gradient(ellipse 120% 80% at 50% -20%, rgba(99, 102, 241, 0.18), transparent 55%),
              radial-gradient(ellipse 90% 70% at 100% 30%, rgba(121, 188, 247, 0.22), transparent 50%),
              radial-gradient(ellipse 85% 65% at 0% 85%, rgba(168, 85, 247, 0.14), transparent 55%),
              radial-gradient(ellipse 70% 50% at 50% 100%, rgba(99, 102, 241, 0.08), transparent 60%)
            `,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-transparent to-violet-50/90" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple/35 via-blue/25 to-pink/30 blur-lg" />
              <img
                src={LOGO_URL}
                alt="La Neta"
                width={48}
                height={48}
                className="relative h-12 w-12 rounded-2xl shadow-md ring-2 ring-white/90"
              />
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            La Neta
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem] sm:leading-tight">
            We’re sorry to see you go
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-600">
            If you no longer wish to receive communications as a creator, confirm your details below.
            We’ll remove your profile from our directory and stop including you in lists, segmentations,
            and campaigns.
          </p>
        </div>

        <div
          className={cn(
            "rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_-12px_rgba(99,102,241,0.18),0_0_0_1px_rgba(255,255,255,0.8)_inset]",
            "backdrop-blur-sm sm:p-8"
          )}
        >
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-900">{done.message}</p>
              {done.creator_deactivated ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Your creator profile has been marked as inactive in our directory.
                </p>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  If this email wasn’t registered as a creator, we’ve only saved your unsubscribe request.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
              <div>
                <label
                  htmlFor="baja-nombre"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Full name
                </label>
                <input
                  id="baja-nombre"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={cn(
                    "mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm",
                    "placeholder:text-slate-400 transition-shadow",
                    "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  )}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="baja-email"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Email address
                </label>
                <input
                  id="baja-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "mt-2 w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm",
                    "placeholder:text-slate-400 transition-shadow",
                    "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  )}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="baja-nota" className="block text-sm font-semibold text-slate-800">
                  Note <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="baja-nota"
                  name="note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(
                    "mt-2 w-full resize-y rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm",
                    "placeholder:text-slate-400 transition-shadow",
                    "focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
                  )}
                  placeholder="Optional short message"
                />
              </div>
              {error && (
                <p className="rounded-xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className={cn(
                  "w-full rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25",
                  "transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                )}
              >
                {busy ? "Submitting…" : "Confirm unsubscribe"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Changed your mind? You can reach out to us again anytime.
        </p>
      </div>
    </main>
  );
}
