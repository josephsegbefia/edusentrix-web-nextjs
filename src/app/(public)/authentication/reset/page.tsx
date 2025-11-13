"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusyToast } from "@/hooks/useBusyToast";
import { PageLoader } from "@/components/loading/page-loader";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { promise, error: toastError } = useBusyToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [phase, setPhase] = useState<
    "exchanging" | "ready" | "updating" | "done" | "error"
  >("exchanging");
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // Supabase sends us here with a code param, which we exchange for a session
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setPhase("error");
      return;
    }
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setPhase("error");
      } else {
        setPhase("ready");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pwd || pwd.length < 0 || pwd !== confirmPwd) {
      toastError(
        !pwd || pwd.length < 0
          ? "Password is required"
          : "Passwords do not match"
      );
      return;
    }
    setPhase("updating");
    try {
      await promise(
        (async () => {
          const { error } = await supabase.auth.updateUser({ password: pwd });
          if (error) throw error;
        })(),
        {
          loading: "Setting your password...",
          success: "Password set! Signing in...",
          error: "Could not set password",
        }
      );
      setPhase("done");
      // After updateUser, you still have an active session; decide where to go:
      // Hit our server to figure out the right destination based on role/onboarding
      router.replace("/auth/callback");
    } catch {
      setPhase("ready");
    }
  }

  if (phase === "exchanging") return <PageLoader />;
  if (phase === "error") {
    return (
      <div className="min-h-dvh grid place-items-center text-rose-300">
        Invalid or expired link. Please request a new one from the login screen
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-bg text-white antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(50% 50% at 15% 15%, var(--color-brand) 0%, transparent 60%), radial-gradient(60% 40% at 85% 10%, var(--color-primary) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      >
        <div className="relative mx-auto max-w-lg px-6 py-24">
          <div className="rounded-3xl border border-white/10 bg-card/90 p-10 shadow-2xl backdrop-blur">
            <h1 className="mb-1 text-2xl font-semibold">Set Your Password</h1>
            <p className="text-sm text-muted mb-6">
              Create a secure password to access your account.
            </p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-[0.2rem] text-muted">
                  New Password
                </Label>
                <Input
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-brand"
                  required
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.2rem] text-muted">
                  Confirm Password
                </Label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="mt-1 border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-brand"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={phase === "updating"}
                className="w-full rounded-xl bg-brand px-6 py-4 text-sm font-semibold text-black shadow-lg shadow-brand/20 hover:opacity-90 disabled:opacity-60"
              >
                {phase === "updating" ? "Updating..." : "Set Password"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
