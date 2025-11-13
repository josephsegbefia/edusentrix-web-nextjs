/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useBusyToast } from "@/hooks/useBusyToast";

type Step = "email" | "password";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [exists, setExists] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const params = useSearchParams();
  const router = useRouter();
  const urlError = params.get("error") || undefined;
  const next = params.get("next") || undefined;
  const { promise, error: toastError, success: toastSuccess } = useBusyToast();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const req = fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await promise(req, {
        loading: "Checking email…",
        success: "Email found",
        error: "Failed to check email",
      });

      // Handle Next.js 15 wrapped responses - unwrap if needed
      const response =
        res && typeof res === "object" && "unwrap" in res
          ? await (res as { unwrap: () => Promise<Response> }).unwrap()
          : (res as unknown as Response);

      const data = await response.json();
      if (!data?.exists) {
        setExists(false);
        toastError(
          "We couldn't find that email. Please verify or contact support."
        );
        setSubmitting(false);
        return;
      }

      setExists(true);
      setStep("password");
      setSubmitting(false);
    } catch (err) {
      setSubmitting(false);
      setErrorMsg("Could not verify email. Please try again.");
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1) Ensure there is a Supabase user (create or repair) for this email.
      const req = fetch("/api/auth/ensure-supabase-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      await promise(req, {
        loading: "Preparing your account…",
        success: "Account ready",
        error: "Could not prepare account",
      });

      // 2) Now sign in with password (client-side so Supabase sets cookies)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setSubmitting(false);
        toastError(error.message || "Invalid credentials");
        return;
      }

      // 3) Hand off to callback for role-aware routing & onboarding rules
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL;
      const qs = new URLSearchParams();
      if (next && next.startsWith("/")) qs.set("next", next);
      const dest = `${origin}/auth/callback${
        qs.toString() ? `?${qs.toString()}` : ""
      }`;
      // Use client navigation to avoid a full page flicker
      router.push(dest);
    } catch (err: any) {
      setSubmitting(false);
      const msg =
        err?.message ||
        "We couldn't sign you in. Please check your password and try again.";
      setErrorMsg(msg);
      toastError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-950 via-zinc-900 to-black py-10 px-4 flex items-center justify-center">
      <div className="mx-auto max-w-xl w-full">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl">
          {/* Subtle premium overlays */}
          <div className="absolute inset-0 bg-linear-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-linear-to-tr from-transparent via-blue-500/5 to-purple-500/5 pointer-events-none" />

          {/* Header */}
          <div className="relative border-b border-white/10 bg-linear-to-r from-white/10 via-white/5 to-transparent px-8 py-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {step === "email" ? "Sign in" : "Enter your password"}
            </h1>
            <p className="text-white/60 text-sm">
              {step === "email"
                ? "Enter the email you used for your EduSentrix account."
                : "Welcome back. Please enter your password to continue."}
            </p>
          </div>

          {/* Body */}
          <div className="relative p-8 space-y-6">
            {/* URL error from callback */}
            {urlError && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-sm p-4 text-sm text-rose-300">
                Couldn&apos;t complete sign-in (<strong>{urlError}</strong>).
                Please try again.
              </div>
            )}

            {/* Local error */}
            {errorMsg && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-sm p-4">
                <h2 className="text-rose-300 font-semibold text-base">
                  Something went wrong
                </h2>
                <p className="text-sm text-rose-300/80 mt-1">{errorMsg}</p>
              </div>
            )}

            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-white/80"
                  >
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-6 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Checking…
                    </span>
                  ) : (
                    "Continue"
                  )}
                </Button>

                <p className="text-xs text-white/50 text-center">
                  Only approved accounts can sign in.
                </p>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                    Email
                  </Label>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white">
                    <span className="truncate">{email}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setPassword("");
                        setErrorMsg(null);
                      }}
                      className="text-sm text-brand hover:opacity-90"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-white/80"
                  >
                    Password *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Link
                    href={`/authentication/reset${
                      email ? `?email=${encodeURIComponent(email)}` : ""
                    }`}
                    className="text-sm text-brand hover:opacity-90"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !password}
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 px-6 rounded-xl font-semibold text-base transition-all duration-200 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>

                <p className="text-xs text-white/50 text-center">
                  You&apos;ll be redirected automatically after sign-in.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
