"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { Button } from "@/components/ui/button";

function openLegalPage(path: "/terms" | "/privacy") {
  // Build the URL relative to the current origin so it works on any host
  // (localhost, demo subdomain, or production).
  if (typeof window !== "undefined") {
    window.open(window.location.origin + path, "_blank", "noreferrer");
  }
}

export default function AcceptLegalPage() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    if (!accepted || loading) return;
    setLoading(true);
    setError(null);
    let shouldKeepLoading = false;
    try {
      const res = await fetch("/api/account/legal-acceptance", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Could not record acceptance.");
        return;
      }
      // Use a full-page navigation so the app layout re-evaluates auth state
      // and any server-side legal-gate checks pick up the newly saved acceptance.
      shouldKeepLoading = true;
      if (json?.data?.mode === "demo") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/auth/callback";
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      if (!shouldKeepLoading) {
        setLoading(false);
      }
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 px-4 py-10 text-white">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Accept <EduSentrixWordmark className="text-2xl" /> policies
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          Before you continue, review and accept our latest Terms of Use and Privacy Policy.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/75">
            Please read:{" "}
            <button
              type="button"
              onClick={() => openLegalPage("/terms")}
              className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Terms of Use
            </button>
            {" "}and{" "}
            <button
              type="button"
              onClick={() => openLegalPage("/privacy")}
              className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
            >
              Privacy Policy
            </button>
            .
          </p>
          <label className="flex items-start gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/20 text-cyan-400 focus:ring-cyan-400/40"
            />
            <span>
              I have read and accept the{" "}
              <button
                type="button"
                onClick={() => openLegalPage("/terms")}
                className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
              >
                Terms of Use
              </button>
              {" "}and{" "}
              <button
                type="button"
                onClick={() => openLegalPage("/privacy")}
                className="text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          onClick={onContinue}
          disabled={!accepted || loading}
          className="mt-6 h-11 w-full rounded-xl bg-linear-to-r from-violet-500 to-purple-600 text-sm font-semibold text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Accept and continue"
          )}
        </Button>
      </section>
    </main>
  );
}
