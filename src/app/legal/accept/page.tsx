"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";

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
    <main className="m-page relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={authPageGlowStyle} />
      <section className="m-card-strong relative w-full max-w-xl rounded-2xl p-6 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
            <ShieldCheck className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
          </div>
          <ThemeToggle />
        </div>
        <BrandMark size="sm" className="mb-4" />
        <h1 className="text-2xl font-semibold tracking-tight text-(--m-fg)">
          Accept <EduSentrixWordmark className="text-2xl" tone="adaptive" /> policies
        </h1>
        <p className="mt-3 text-sm leading-relaxed m-muted">
          Before you continue, review and accept our latest Terms of Use and Privacy Policy.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-(--m-border) bg-(--m-subtle) p-4">
          <p className="text-sm text-(--m-fg)">
            Please read:{" "}
            <button
              type="button"
              onClick={() => openLegalPage("/terms")}
              className="text-cyan-700 underline-offset-2 hover:text-cyan-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              Terms of Use
            </button>
            {" "}and{" "}
            <button
              type="button"
              onClick={() => openLegalPage("/privacy")}
              className="text-cyan-700 underline-offset-2 hover:text-cyan-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              Privacy Policy
            </button>
            .
          </p>
          <label className="flex items-start gap-3 text-sm m-muted">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border border-(--m-border) bg-(--m-subtle) accent-cyan-600"
            />
            <span>
              I have read and accept the{" "}
              <button
                type="button"
                onClick={() => openLegalPage("/terms")}
                className="text-cyan-700 underline-offset-2 hover:text-cyan-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                Terms of Use
              </button>
              {" "}and{" "}
              <button
                type="button"
                onClick={() => openLegalPage("/privacy")}
                className="text-cyan-700 underline-offset-2 hover:text-cyan-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-800 dark:text-rose-100">
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
