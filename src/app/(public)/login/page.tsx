"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusyToast } from "@/hooks/useBusyToast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const params = useSearchParams();
  const urlError = params.get("error") || undefined;
  const next = params.get("next") || undefined;

  const { promise } = useBusyToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Build a safe redirect URL for the callback
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL;

      const qs = new URLSearchParams();
      if (next && next.startsWith("/")) qs.set("next", next);
      const redirectTo = `${origin}/auth/callback${
        qs.toString() ? `?${qs.toString()}` : ""
      }`;

      const req = supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          // shouldCreateUser: true (default) — leave as-is unless you want to block non-existing users
        },
      });

      // Block UI + show toast lifecycle
      await promise(req, {
        loading: "Sending magic link…",
        success: "Magic link sent! Check your email",
        error: "Failed to send magic link",
      });

      // Only show the success panel AFTER the busy toast resolves successfully
      setSent(true);
    } catch (err) {
      console.error("[login] signInWithOtp error:", err);
      // Only show the error panel AFTER the busy toast resolves with error
      setErrorMsg(
        "We couldn’t send the magic link. Please verify the email and try again."
      );
      setSent(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-10 px-4">
      <div className="mx-auto max-w-xl">
        {" "}
        {/* wider form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
            <h1 className="text-3xl font-bold mb-1">Sign in</h1>
            <p className="text-blue-100 opacity-90">
              We’ll email you a secure magic link to sign in
            </p>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* URL error (e.g., unauthorized on return) */}
            {urlError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Couldn’t complete sign-in (<strong>{urlError}</strong>). Please
                try again.
              </div>
            )}

            {/* Show ONLY after busy toast resolves with error */}
            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h2 className="text-red-800 font-semibold">
                  Something went wrong
                </h2>
                <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
              </div>
            )}

            {/* Show ONLY after busy toast resolves with success */}
            {sent ? (
              <div className="text-center">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📧</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Check your email
                  </h2>
                  <p className="text-gray-600 mt-1">
                    We sent a magic sign-in link to <strong>{email}</strong>.
                    Open it on this device to finish signing in.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => {
                    setSent(false);
                    setErrorMsg(null);
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-gray-700"
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
                    className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-3 px-6 rounded-lg font-semibold text-base transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50 cursor-pointer"
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
                      Sending link…
                    </span>
                  ) : (
                    "Send magic link"
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  You’ll be redirected back here automatically after clicking
                  the link.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
